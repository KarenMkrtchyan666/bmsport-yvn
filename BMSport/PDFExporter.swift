import UIKit
import CoreText

enum PDFExporter {
    static let page = CGRect(x: 0, y: 0, width: 595.276, height: 841.89)

    /// Core Text cascades from the system font to installed Armenian glyphs.
    /// Each block flows across as many A4 pages as needed, including a single long paragraph.
    static func render(_ report: ReportData, id: UUID) throws -> Data {
        let body = NSMutableAttributedString(string: "")
        func append(_ text: String, heading: Bool = false) {
            let style = NSMutableParagraphStyle()
            style.lineSpacing = 4
            style.paragraphSpacing = heading ? 8 : 14
            let font = heading ? UIFont.boldSystemFont(ofSize: 13) : UIFont.systemFont(ofSize: 11)
            body.append(NSAttributedString(string: text + "\n", attributes: [.font: font, .foregroundColor: heading ? UIColor.systemBlue : UIColor.black, .paragraphStyle: style]))
        }
        append("ДИАГНОСТИЧЕСКИЙ ОТЧЁТ / Ախտորոշման հաշվետվություն", heading: true)
        append("Дата: \(report.date.formatted(date: .numeric, time: .omitted))\nОтчёт: \(id.uuidString)")
        append("КЛИЕНТ / Հաճախորդ", heading: true)
        append("\(report.client)\nТелефон: \(report.phone)")
        append("АВТОМОБИЛЬ / Ավտոմեքենա", heading: true)
        append("\(report.vehicle) · \(report.year)\nVIN: \(report.vin.isEmpty ? "—" : report.vin)\nГосномер: \(report.plate.isEmpty ? "—" : report.plate)\nПробег: \(report.mileage) км")
        append("ОШИБКИ ДО РАБОТ / Սխալներ", heading: true)
        if report.faults.isEmpty { append("Диагностические коды не указаны.") }
        for (i, fault) in report.faults.enumerated() {
            append("\(i + 1). \(fault.code) — \(fault.resolved ? "УСТРАНЕНА / Վերացված" : "ОСТАЛАСЬ / Մնացել է")", heading: true)
            append(fault.description.isEmpty ? "Описание не указано" : fault.description)
            if let block = fault.block, !block.isEmpty { append("Блок / Control unit: \(block)") }
        }
        for (title, content) in [("ОПИСАНИЕ / Նկարագրություն", report.notes), ("ВЫПОЛНЕННЫЕ РАБОТЫ / Կատարված աշխատանքներ", report.work), ("РЕКОМЕНДАЦИИ / Խորհուրդներ", report.recommendations)] {
            append(title, heading: true); append(content.isEmpty ? "—" : content)
        }
        let framesetter = CTFramesetterCreateWithAttributedString(body)
        let format = UIGraphicsPDFRendererFormat()
        format.documentInfo = [kCGPDFContextTitle as String: "BMSPORT YVN Diagnostic Report", kCGPDFContextAuthor as String: "BMSPORT YVN · Ереван · @bmsport_yvn"]
        var layoutFailed = false
        let result = UIGraphicsPDFRenderer(bounds: page, format: format).pdfData { renderer in
            var offset = 0
            var pageNumber = 0
            while offset < body.length {
                renderer.beginPage(); pageNumber += 1
                let cg = renderer.cgContext
                UIColor(red: 0.04, green: 0.08, blue: 0.15, alpha: 1).setFill()
                cg.fill(CGRect(x: 0, y: 0, width: page.width, height: 90))
                ("BMSPORT YVN" as NSString).draw(at: CGPoint(x: 36, y: 23), withAttributes: [.font: UIFont.boldSystemFont(ofSize: 24), .foregroundColor: UIColor.white])
                ("Diagnostic Reports · Ереван · @bmsport_yvn" as NSString).draw(at: CGPoint(x: 36, y: 57), withAttributes: [.font: UIFont.systemFont(ofSize: 10), .foregroundColor: UIColor.white])
                UIColor.systemBlue.setFill(); cg.fill(CGRect(x: 0, y: 90, width: page.width, height: 4))
                let content = CGRect(x: 36, y: 70, width: page.width - 72, height: page.height - 182)
                cg.saveGState()
                cg.textMatrix = .identity
                cg.translateBy(x: 0, y: page.height)
                cg.scaleBy(x: 1, y: -1)
                let frame = CTFramesetterCreateFrame(framesetter, CFRange(location: offset, length: 0), CGPath(rect: content, transform: nil), nil)
                CTFrameDraw(frame, cg)
                let visible = CTFrameGetVisibleStringRange(frame)
                cg.restoreGState()
                ("BMSPORT YVN · \(id.uuidString.prefix(8)) · Страница \(pageNumber)" as NSString).draw(at: CGPoint(x: 36, y: page.height - 40), withAttributes: [.font: UIFont.systemFont(ofSize: 9), .foregroundColor: UIColor.darkGray])
                guard visible.length > 0 else { layoutFailed = true; break }
                offset += visible.length
            }
        }
        if layoutFailed { throw CocoaError(.fileWriteUnknown) }
        return result
    }
    static func export(_ report: ReportData, id: UUID) throws -> URL {
        let data = try render(report, id: id)
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent("BMSportPDF", isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let url = folder.appendingPathComponent("BMSPORT-\(id.uuidString)-\(UUID().uuidString.prefix(8)).pdf")
        try data.write(to: url, options: [.atomic, .completeFileProtection])
        return url
    }
}
