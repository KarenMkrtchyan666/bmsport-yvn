import XCTest
import SwiftData
import PDFKit
@testable import BMSport

final class BMSportTests: XCTestCase {
    func validReport() -> ReportData {
        var data = ReportData()
        data.client = "Արամ Иванов"; data.phone = "+374 99 123456"
        data.vehicle = "BMW 530i"; data.year = "2020"; data.mileage = "75000"
        data.vin = "WBA12345678901234"
        data.faults = [Fault(code: "P0300", description: "Пропуски зажигания / Բոցավառման բացթողումներ", resolved: true), Fault(code: "P0420", description: "Катализатор", resolved: false)]
        return data
    }
    func testValidationAndDraftRoundTrip() throws {
        XCTAssertFalse(ReportData().validation.isEmpty)
        var data = validReport()
        XCTAssertTrue(data.validation.isEmpty)
        data.vin = "INVALID"
        XCTAssertFalse(data.validation.isEmpty)
        let draft = try DiagnosticReport(data: data)
        XCTAssertEqual(try draft.read(), data)
    }
    @MainActor func testCreateEditAndReadAfterReopen() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let url = directory.appendingPathComponent("test.store")
        let id: UUID
        do {
            let container = try ModelContainer(for: DiagnosticReport.self, configurations: ModelConfiguration(url: url, cloudKitDatabase: .none))
            var data = validReport()
            let item = try ReportStore.save(data, draft: true, existing: nil, context: container.mainContext)
            id = item.id
            data.work = "Замена свечей"
            _ = try ReportStore.save(data, draft: false, existing: item, context: container.mainContext)
        }
        let reopened = try ModelContainer(for: DiagnosticReport.self, configurations: ModelConfiguration(url: url, cloudKitDatabase: .none))
        let records = try reopened.mainContext.fetch(FetchDescriptor<DiagnosticReport>())
        XCTAssertEqual(records.count, 1)
        XCTAssertEqual(records.first?.id, id)
        XCTAssertEqual(try records.first?.read().work, "Замена свечей")
        XCTAssertEqual(records.first?.isDraft, false)
    }
    func testCorruptPayloadDoesNotBecomeBlankReport() throws {
        let report = try DiagnosticReport(data: validReport())
        report.payload = Data([0, 1, 2])
        XCTAssertThrowsError(try report.read())
    }
    func testA4MultipagePDFAndUnicode() throws {
        var data = validReport()
        data.notes = String(repeating: "Русский текст. Հայերեն տեքստ։ Длинная строка диагностики.\n", count: 350)
        data.recommendations = "END-OF-REPORT Վերջ"
        let pdf = try XCTUnwrap(PDFDocument(data: PDFExporter.render(data, id: UUID())))
        XCTAssertGreaterThan(pdf.pageCount, 2)
        for index in 0..<pdf.pageCount {
            let bounds = try XCTUnwrap(pdf.page(at: index)).bounds(for: .mediaBox)
            XCTAssertEqual(bounds.width, 595.276, accuracy: 0.1)
            XCTAssertEqual(bounds.height, 841.89, accuracy: 0.1)
        }
        let text = try XCTUnwrap(pdf.string)
        XCTAssertTrue(text.contains("Иванов"))
        XCTAssertTrue(text.contains("Արամ"))
        XCTAssertTrue(text.contains("УСТРАНЕНА"))
        XCTAssertTrue(text.contains("ОСТАЛАСЬ"))
        XCTAssertTrue(text.contains("END-OF-REPORT"))
    }
    func testExportProducesReadableFile() throws {
        let url = try PDFExporter.export(validReport(), id: UUID())
        defer { try? FileManager.default.removeItem(at: url) }
        XCTAssertNotNil(PDFDocument(url: url))
        XCTAssertGreaterThan(try Data(contentsOf: url).count, 1000)
    }
}
