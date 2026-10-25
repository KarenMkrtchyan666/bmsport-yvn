import SwiftUI
import SwiftData
import UIKit

struct SharedPDF: Identifiable { let id = UUID(); let url: URL }

struct EditorView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.dismiss) private var dismiss
    @State private var report: DiagnosticReport?
    @State private var data: ReportData
    @State private var message: String?
    @State private var saved = ""
    @State private var sharedPDF: SharedPDF?
    @State private var dirty = false
    init(report: DiagnosticReport?, initial: ReportData) {
        _report = State(initialValue: report)
        _data = State(initialValue: initial)
    }
    var body: some View {
        Form {
            Section("Клиент") {
                field("Имя клиента", text: $data.client, id: "client")
                field("Телефон", text: $data.phone, id: "phone").keyboardType(.phonePad)
            }
            Section("Автомобиль") {
                field("Марка / модель", text: $data.vehicle, id: "vehicle")
                field("Год", text: $data.year, id: "year").keyboardType(.numberPad)
                field("VIN (если известен)", text: $data.vin, id: "vin").textInputAutocapitalization(.characters).autocorrectionDisabled()
                field("Госномер", text: $data.plate, id: "plate")
                field("Пробег, км", text: $data.mileage, id: "mileage").keyboardType(.numberPad)
                DatePicker("Дата диагностики", selection: $data.date, displayedComponents: .date)
            }
            Section("Ошибки до работ") {
                ForEach($data.faults) { $fault in
                    VStack(alignment: .leading) {
                        TextField("Код (например P0300)", text: $fault.code).textInputAutocapitalization(.characters)
                        TextField("Описание ошибки", text: $fault.description, axis: .vertical)
                        Toggle(fault.resolved ? "Устранена" : "Осталась", isOn: $fault.resolved)
                        Button("Удалить ошибку", role: .destructive) { data.faults.removeAll { $0.id == fault.id } }
                    }.padding(.vertical, 4)
                }
                Button("Добавить ошибку") { data.faults.append(Fault()) }
            }
            Section("Описание диагностики") { TextField("Наблюдения и результаты", text: $data.notes, axis: .vertical).lineLimit(3...12) }
            Section("Выполненные работы") { TextField("Что выполнено", text: $data.work, axis: .vertical).lineLimit(3...12) }
            Section("Рекомендации") { TextField("Следующие действия", text: $data.recommendations, axis: .vertical).lineLimit(3...12) }
            Section {
                Button("Сохранить черновик") { save(draft: true) }.accessibilityIdentifier("saveDraft")
                Button("Завершить отчёт") { if validate() { save(draft: false) } }.accessibilityIdentifier("complete")
                Button { export() } label: { Label("PDF / Поделиться", systemImage: "square.and.arrow.up") }.accessibilityIdentifier("exportPDF")
                if !saved.isEmpty { Text(saved).font(.caption).foregroundStyle(.secondary).accessibilityIdentifier("saveStatus") }
            } footer: { Text("Черновик сохраняется автоматически после изменения и при уходе в фон. PDF доступен после проверки обязательных полей. VIN и госномер можно оставить пустыми.") }
        }
        .navigationTitle("Диагностический отчёт")
        .navigationBarTitleDisplayMode(.inline)
        .interactiveDismissDisabled(dirty)
        .navigationBarBackButtonHidden(dirty)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Закрыть") { if !dirty || save(draft: true) { dismiss() } }
            }
            ToolbarItemGroup(placement: .keyboard) { Spacer(); Button("Готово") { UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil) } }
        }
        .onChange(of: data) { _, _ in dirty = true; saved = "Есть несохранённые изменения" }
        .task(id: data) {
            guard dirty else { return }
            do { try await Task.sleep(for: .milliseconds(650)) } catch { return }
            guard dirty else { return }
            save(draft: true)
        }
        .onChange(of: scenePhase) { _, phase in if phase != .active && dirty { save(draft: true) } }
        .onDisappear { if dirty { save(draft: true) } }
        .alert("BMSPORT YVN", isPresented: Binding(get: { message != nil }, set: { if !$0 { message = nil } })) { Button("OK") { message = nil } } message: { Text(message ?? "") }
        .sheet(item: $sharedPDF) { item in ShareSheet(url: item.url) }
    }
    private func field(_ title: String, text: Binding<String>, id: String) -> some View {
        TextField(title, text: text).accessibilityIdentifier(id)
    }
    @discardableResult private func save(draft: Bool) -> Bool {
        do {
            report = try ReportStore.save(data, draft: draft, existing: report, context: context)
            dirty = false
            saved = draft ? "Черновик сохранён" : "Отчёт сохранён"
            return true
        } catch { message = "Не удалось сохранить. Не закрывайте отчёт. Проверьте свободное место и повторите.\n\(error.localizedDescription)"; return false }
    }
    private func validate() -> Bool {
        guard data.validation.isEmpty else { message = data.validation.joined(separator: "\n"); return false }
        return true
    }
    private func export() {
        guard validate(), save(draft: false), let report else { return }
        do { sharedPDF = SharedPDF(url: try PDFExporter.export(data, id: report.id)) }
        catch { message = "PDF не создан: \(error.localizedDescription)" }
    }
}

struct ShareSheet: UIViewControllerRepresentable {
    let url: URL
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: [url], applicationActivities: nil)
    }
    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
