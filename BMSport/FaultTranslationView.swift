import SwiftUI
import Translation
import NaturalLanguage

@available(iOS 18.0, *)
struct FaultTranslationView: View {
    @Binding var faults: [Fault]
    let onError: (String) -> Void
    @State private var configuration: TranslationSession.Configuration?
    @State private var source = "de"
    @State private var running = false
    @State private var pending: [(UUID, String)] = []
    @State private var translatedIDs = Set<UUID>()
    var body: some View {
        VStack(alignment: .leading) {
            Picker("Язык диагностики", selection: $source) { Text("Deutsch").tag("de"); Text("Русский").tag("ru"); Text("Français").tag("fr"); Text("Italiano").tag("it"); Text("Español").tag("es") }
            Button(running ? "Переводим…" : "Перевести ошибки на английский") { start() }.disabled(running || faults.isEmpty)
            Text("Перевод выполняется на устройстве. Система может предложить загрузить языки. Исходный текст сохраняется.").font(.caption).foregroundStyle(.secondary)
        }.onAppear { autoStart() }
        .onChange(of: faults.map(\.id)) { _, _ in autoStart() }
        .translationTask(configuration) { session in
            let snapshot = pending
            do {
                let requests = snapshot.map { TranslationSession.Request(sourceText: $0.1, clientIdentifier: $0.0.uuidString) }
                let responses = try await session.translations(from: requests)
                for response in responses {
                    guard let id = response.clientIdentifier.flatMap(UUID.init(uuidString:)), let original = snapshot.first(where: { $0.0 == id })?.1, let index = faults.firstIndex(where: { $0.id == id }), faults[index].description == original else { continue }
                    faults[index].originalDescription = faults[index].originalDescription ?? original
                    faults[index].description = response.targetText
                    translatedIDs.insert(id)
                }
            } catch { onError("Перевод не завершён. Исходный текст сохранён. \(error.localizedDescription)") }
            running = false
        }
    }
    private func start() {
        pending = faults.filter { !$0.description.isEmpty && !translatedIDs.contains($0.id) && NLLanguageRecognizer.dominantLanguage(for: $0.description)?.rawValue == source }.map { ($0.id, $0.description) }
        guard !pending.isEmpty else { return }
        running = true
        configuration = .init(source: Locale.Language(identifier: source), target: Locale.Language(identifier: "en"))
        configuration?.invalidate()
    }
    private func autoStart() {
        guard !running, let text = faults.first(where: { !$0.description.isEmpty && !translatedIDs.contains($0.id) && NLLanguageRecognizer.dominantLanguage(for: $0.description) != .english })?.description else { return }
        let detected = NLLanguageRecognizer.dominantLanguage(for: text)?.rawValue ?? "de"
        if ["de", "ru", "fr", "it", "es"].contains(detected) { source = detected; start() }
    }
}
