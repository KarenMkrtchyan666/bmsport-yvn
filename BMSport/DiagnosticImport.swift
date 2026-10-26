import Foundation
import PDFKit
import Vision
import UIKit

enum DiagnosticImport {
    struct Result { let text: String; let usedOCR: Bool }
    static func read(_ url: URL) async throws -> Result {
        let granted = url.startAccessingSecurityScopedResource()
        defer { if granted { url.stopAccessingSecurityScopedResource() } }
        let bytes = try Data(contentsOf: url, options: .mappedIfSafe)
        guard bytes.count <= 10 * 1024 * 1024, bytes.starts(with: Data("%PDF-".utf8)) else { throw ImportError.invalidPDF }
        return try await Task.detached(priority: .userInitiated) {
            guard let pdf = PDFDocument(data: bytes), !pdf.isLocked, pdf.pageCount > 0, pdf.pageCount <= 40 else { throw ImportError.invalidPDF }
            var pages: [String] = []; var usedOCR = false
            for index in 0..<pdf.pageCount {
                try Task.checkCancellation()
                guard let page = pdf.page(at: index) else { continue }
                var text = page.string ?? ""
                if text.trimmingCharacters(in: .whitespacesAndNewlines).count < 20 {
                    let image = page.thumbnail(of: CGSize(width: 1654, height: 2339), for: .mediaBox)
                    guard let cgImage = image.cgImage else { throw ImportError.ocr }
                    let request = VNRecognizeTextRequest(); request.recognitionLevel = .accurate; request.usesLanguageCorrection = false
                    let available = try request.supportedRecognitionLanguages()
                    request.recognitionLanguages = ["en-US", "de-DE", "ru-RU"].filter { available.contains($0) }
                    try VNImageRequestHandler(cgImage: cgImage, options: [:]).perform([request])
                    text = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n"); usedOCR = true
                }
                pages.append("--- Page \(index + 1) ---\n" + text)
            }
            return Result(text: pages.joined(separator: "\n"), usedOCR: usedOCR)
        }.value
    }
    static func faults(from text: String) -> [Fault] {
        let pattern = #"(?i)(?<![A-Z0-9])(?:0x[0-9A-F]{4,8}|[PBCU][0-3][0-9A-F]{3}(?:[-:][0-9A-F]{2})?|[0-9]{6}|0[0-9]{4}|(?=[0-9A-F]{4,8}(?![A-Z0-9]))(?=[0-9A-F]*[A-F])(?=[0-9A-F]*[0-9])[0-9A-F]{4,8})(?![A-Z0-9])"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return [] }
        var block = "", result: [Fault] = [], seen = Set<String>()
        for raw in text.components(separatedBy: .newlines) {
            let line = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            if line.range(of: #"(?i)^(error type|readiness|frequency|mileage|kilometer|fault frequency|environment|status|пробег|частота|условия|дата|vin|---)"#, options: .regularExpression) != nil { continue }
            if line.range(of: #"(?i)^(block|блок|steuerger[aä]t|control unit|ecu)\s*[:\-]"#, options: .regularExpression) != nil {
                block = line.replacingOccurrences(of: #"(?i)^(block|блок|steuerger[aä]t|control unit|ecu)\s*[:\-]\s*"#, with: "", options: .regularExpression); continue
            }
            if line.range(of: #"(?i)\bINPA\s*-\s*Loader:"#, options: .regularExpression) != nil {
                block = line.components(separatedBy: ":").dropFirst().joined(separator: ":").components(separatedBy: "Version")[0].trimmingCharacters(in: .whitespaces); continue
            }
            if line.range(of: #"(?i)read error memory"#, options: .regularExpression) != nil { block = line.replacingOccurrences(of: #"(?i)\s*read error memory.*"#, with: "", options: .regularExpression); continue }
            if line.range(of: #"(?i)^(DME|DDE|DSC|ABS|EGS|BDC|FEM|FRM|CAS|JBE|KOMBI|ICM|ACSM|SRS|IHKA|EPS|VTG|ZGM|CIC|NBT|PDC)\b"#, options: .regularExpression) != nil {
                let candidate = line.components(separatedBy: .whitespaces)[0]
                if !candidate.isEmpty { block = candidate }
            }
            let ns = line as NSString
            guard let match = regex.firstMatch(in: line, range: NSRange(location: 0, length: ns.length)) else { continue }
            // Only accept standalone hex codes at the start, unless explicitly prefixed by 0x or an OBD letter.
            let code = ns.substring(with: match.range)
            let prefix = ns.substring(to: match.range.location).trimmingCharacters(in: .whitespaces)
            if match.range.location > 0 && prefix != block && prefix.range(of: #"(?i)^(DTC|Code|Fault(?: code)?|Код(?: ошибки)?)\s*[:#\-]?\s*$"#, options: .regularExpression) == nil && !code.lowercased().hasPrefix("0x") && code.range(of: #"^[PBCU]"#, options: .regularExpression) == nil { continue }
            let description = ns.substring(from: NSMaxRange(match.range)).trimmingCharacters(in: CharacterSet.whitespaces.union(CharacterSet(charactersIn: ":;-–—|")))
            guard !description.isEmpty else { continue }
            let key = block + "|" + code.uppercased()
            if seen.insert(key).inserted { result.append(Fault(code: code, description: description, resolved: false, block: block, originalDescription: description)) }
            if result.count >= 100 { break }
        }
        return result
    }
    static func persist(_ url: URL) throws -> String {
        let granted = url.startAccessingSecurityScopedResource(); defer { if granted { url.stopAccessingSecurityScopedResource() } }
        let bytes = try Data(contentsOf: url)
        guard bytes.count <= 10 * 1024 * 1024, bytes.starts(with: Data("%PDF-".utf8)) else { throw ImportError.invalidPDF }
        let filename = UUID().uuidString + ".pdf"
        let folder = try attachmentDirectory(); try bytes.write(to: folder.appendingPathComponent(filename), options: [.atomic, .completeFileProtection])
        return filename
    }
    static func attachmentDirectory() throws -> URL {
        let folder = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true).appendingPathComponent("DiagnosticAttachments", isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true); return folder
    }
    static func attachment(_ filename: String) throws -> URL {
        guard filename == URL(fileURLWithPath: filename).lastPathComponent, filename.hasSuffix(".pdf") else { throw ImportError.invalidPDF }
        return try attachmentDirectory().appendingPathComponent(filename)
    }
    enum ImportError: LocalizedError {
        case invalidPDF, ocr
        var errorDescription: String? { switch self { case .invalidPDF: return "Выберите незашифрованный PDF до 10 МБ и 40 страниц."; case .ocr: return "Не удалось распознать страницу PDF." } }
    }
}
