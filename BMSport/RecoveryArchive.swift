import Foundation

/// Independent per-report journal. Written before SwiftData commit so an I/O failure
/// never silently discards the user's most recent successfully journaled edit.
struct RecoveryArchive: Codable {
    let schemaVersion: Int
    let id: UUID
    let savedAt: Date
    let isDraft: Bool
    let report: ReportData

    static func write(_ report: ReportData, id: UUID, draft: Bool) throws {
        let root = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        let folder = root.appendingPathComponent("Recovery", isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let archive = RecoveryArchive(schemaVersion: 1, id: id, savedAt: Date(), isDraft: draft, report: report)
        let target = folder.appendingPathComponent("\(id.uuidString).json")
        // Keep the previous version as well. Never copy the live SQLite store.
        let previous = folder.appendingPathComponent("\(id.uuidString).previous.json")
        if FileManager.default.fileExists(atPath: target.path) {
            let old = try Data(contentsOf: target)
            try old.write(to: previous, options: [.atomic, .completeFileProtection])
        }
        try JSONEncoder().encode(archive).write(to: target, options: [.atomic, .completeFileProtection])
    }
}
