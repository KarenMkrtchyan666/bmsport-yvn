import SwiftUI
import SwiftData

struct HistoryView: View {
    @Query(sort: \DiagnosticReport.updatedAt, order: .reverse) private var reports: [DiagnosticReport]
    @State private var search = ""
    @State private var newReport = false
    @State private var error: String?
    @State private var selectedModel = ""
    @AppStorage("bmsport-language") private var language = "ru"
    private var modelNames: [String] { Array(Set(reports.compactMap { try? $0.read().modelIdentity }.filter { !$0.isEmpty })).sorted { $0.localizedStandardCompare($1) == .orderedAscending } }
    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 5) {
                        Text("BMSPORT YVN").font(.title.bold())
                        Text("Diagnostic Reports · Ереван").foregroundStyle(.secondary)
                        Text("Instagram @bmsport_yvn").font(.caption).foregroundStyle(.blue)
                    }.padding(.vertical, 8)
                }
                Section("История диагностики") {
                    Picker("Модель автомобиля", selection: $selectedModel) {
                        Text("Все модели").tag("")
                        ForEach(modelNames, id: \.self) { Text($0).tag($0) }
                    }
                    ForEach(reports.filter(matches)) { report in
                        if let data = try? report.read() {
                            NavigationLink {
                                EditorView(report: report, initial: data)
                            } label: {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(data.vehicle.isEmpty ? "Новый отчёт" : data.vehicle).font(.headline)
                                    Text(data.client.isEmpty ? "Клиент не указан" : data.client)
                                    Text("\(data.plate) · \(data.date.formatted(date: .numeric, time: .omitted))").font(.caption)
                                    Text(report.isDraft ? "Черновик" : "Завершён").font(.caption.bold()).foregroundStyle(report.isDraft ? .orange : .green)
                                }
                            }
                        } else {
                            Label("Повреждённый отчёт \(report.id.uuidString.prefix(8)). Данные сохранены для восстановления.", systemImage: "exclamationmark.triangle").foregroundStyle(.red)
                        }
                    }
                    if reports.isEmpty { Text("Создайте первый отчёт кнопкой +").foregroundStyle(.secondary) }
                }
            }
            .navigationTitle("Отчёты")
            .searchable(text: $search, prompt: "Клиент, телефон, VIN, номер, автомобиль")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Picker("Язык / Language", selection: $language) { Text("Русский").tag("ru"); Text("English").tag("en") }.pickerStyle(.menu) }
                ToolbarItem(placement: .topBarTrailing) { Button { newReport = true } label: { Image(systemName: "plus") }.accessibilityLabel("Новый отчёт") }
            }
            .sheet(isPresented: $newReport) { NavigationStack { EditorView(report: nil, initial: ReportData()) } }
            .environment(\.locale, Locale(identifier: language))
            .preferredColorScheme(.dark)
        }
    }
    private func matches(_ report: DiagnosticReport) -> Bool {
        guard let d = try? report.read() else { return true }
        guard selectedModel.isEmpty || d.modelIdentity == selectedModel else { return false }
        guard !search.isEmpty else { return true }
        return [d.client, d.phone, d.vehicle, d.vin, d.plate].joined(separator: " ").localizedCaseInsensitiveContains(search)
    }
}
