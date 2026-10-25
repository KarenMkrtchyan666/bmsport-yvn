import Foundation
import SwiftData

struct Fault: Codable, Identifiable, Equatable {
    var id = UUID()
    var code = ""
    var description = ""
    var resolved = false
}

struct ReportData: Codable, Equatable {
    var client = ""
    var phone = ""
    var vehicle = ""
    var year = ""
    var vin = ""
    var plate = ""
    var mileage = ""
    var date = Date()
    var faults: [Fault] = []
    var notes = ""
    var work = ""
    var recommendations = ""

    var validation: [String] {
        var errors: [String] = []
        if client.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { errors.append("Введите имя клиента") }
        let digits = phone.filter(\.isNumber)
        if !(7...15).contains(digits.count) { errors.append("Телефон: от 7 до 15 цифр") }
        if vehicle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { errors.append("Введите марку и модель") }
        let maxYear = Calendar.current.component(.year, from: Date()) + 1
        if let value = Int(year), (1886...maxYear).contains(value) {} else { errors.append("Проверьте год выпуска") }
        if !vin.isEmpty && (vin.count != 17 || vin.uppercased().range(of: "^[A-HJ-NPR-Z0-9]{17}$", options: .regularExpression) == nil) { errors.append("VIN: 17 латинских букв и цифр, без I, O, Q") }
        if let km = Int(mileage), (0...9_999_999).contains(km) {} else { errors.append("Пробег: целое число от 0 до 9 999 999") }
        if faults.contains(where: { $0.code.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }) { errors.append("Укажите код каждой ошибки или удалите пустую строку") }
        return errors
    }
}

@Model final class DiagnosticReport {
    @Attribute(.unique) var id: UUID
    var updatedAt: Date
    var isDraft: Bool
    var payload: Data
    init(id: UUID = UUID(), data: ReportData = ReportData(), isDraft: Bool = true) throws {
        self.id = id
        self.updatedAt = Date()
        self.isDraft = isDraft
        self.payload = try JSONEncoder().encode(data)
    }
    func read() throws -> ReportData { try JSONDecoder().decode(ReportData.self, from: payload) }
}

@MainActor enum ReportStore {
    static func save(_ data: ReportData, draft: Bool, existing: DiagnosticReport?, context: ModelContext) throws -> DiagnosticReport {
        let encoded = try JSONEncoder().encode(data)
        let report = try existing ?? DiagnosticReport(data: data)
        if !ProcessInfo.processInfo.arguments.contains("--ui-testing") {
            try RecoveryArchive.write(data, id: report.id, draft: draft)
        }
        let oldPayload = report.payload
        let oldDraft = report.isDraft
        let oldDate = report.updatedAt
        if existing == nil { context.insert(report) }
        report.payload = encoded
        report.isDraft = draft
        report.updatedAt = Date()
        do { try context.save() }
        catch {
            if existing == nil { context.delete(report) }
            else { report.payload = oldPayload; report.isDraft = oldDraft; report.updatedAt = oldDate }
            throw error
        }
        return report
    }
}
