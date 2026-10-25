import SwiftUI
import SwiftData

@main struct BMSportApp: App {
    private let container: ModelContainer?
    private let startupError: String?
    init() {
        do {
            let testing = ProcessInfo.processInfo.arguments.contains("--ui-testing")
            let config = ModelConfiguration(isStoredInMemoryOnly: testing, cloudKitDatabase: .none)
            container = try ModelContainer(for: DiagnosticReport.self, configurations: config)
            container?.mainContext.autosaveEnabled = false
            startupError = nil
        } catch {
            container = nil
            startupError = error.localizedDescription
        }
    }
    var body: some Scene {
        WindowGroup {
            if let container {
                HistoryView().modelContainer(container).tint(.blue)
            } else {
                ContentUnavailableView {
                    Label("Не удалось открыть историю", systemImage: "externaldrive.badge.exclamationmark")
                } description: {
                    Text("Данные не удалены. Перезапустите приложение и проверьте свободное место. Не удаляйте приложение: обратитесь к разработчику для восстановления.\n\n" + (startupError ?? ""))
                }
            }
        }
    }
}
