import SwiftUI
import SwiftData
import UIKit
import UniformTypeIdentifiers
import PDFKit

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
    @State private var picker: VehiclePickerKind?
    @State private var importing = false
    @State private var recognizing = false
    @State private var originalPDF: SharedPDF?
    @State private var vinStatus = ""
    @State private var generatedVehicle: String?
    @AppStorage("bmsport-language") private var language = "ru"
    @AppStorage("bmsport-online-photos") private var onlinePhotos = false
    private enum VehiclePickerKind: String, Identifiable { case brand, model; var id: String { rawValue } }
    init(report: DiagnosticReport?, initial: ReportData) {
        _report = State(initialValue: report)
        _data = State(initialValue: initial)
    }
    var body: some View {
        Form {
            Section {
                Picker("Язык / Language", selection: $language) { Text("Русский").tag("ru"); Text("English").tag("en") }
            }
            Section("Клиент") {
                field("Имя клиента", text: $data.client, id: "client")
                field("Телефон", text: $data.phone, id: "phone").keyboardType(.phonePad)
            }
            Section("Автомобиль") {
                if let brand = data.brand, !brand.isEmpty {
                    if onlinePhotos, let model = data.model, !model.isEmpty { VehiclePhotoView(brand: brand, model: model) }
                    else { BrandIdentityView(brand: brand) }
                }
                field("VIN (если известен)", text: $data.vin, id: "vin").textInputAutocapitalization(.characters).autocorrectionDisabled()
                Button("Определить по VIN") { decodeVIN() }
                if !vinStatus.isEmpty { Text(vinStatus).font(.caption).foregroundStyle(.secondary) }
                Button { picker = .brand } label: { LabeledContent("Марка автомобиля", value: data.brand ?? "Выбрать") }
                if !(data.brand ?? "").isEmpty { Button { picker = .model } label: { LabeledContent("Модель автомобиля", value: data.model ?? "Выбрать") } }
                field("Марка / модель", text: $data.vehicle, id: "vehicle")
                field("Год", text: $data.year, id: "year").keyboardType(.numberPad)
                field("Госномер", text: $data.plate, id: "plate")
                field("Пробег, км", text: $data.mileage, id: "mileage").keyboardType(.numberPad)
                DatePicker("Дата диагностики", selection: $data.date, displayedComponents: .date)
                Toggle("Справочные фото онлайн", isOn: $onlinePhotos)
                Text("Для фото передаются только марка и модель. VIN и данные клиента остаются на устройстве.").font(.caption).foregroundStyle(.secondary)
            }
            Section("PDF диагностики") {
                Button(recognizing ? "Распознаём PDF…" : "Прикрепить PDF диагностики") { importing = true }.disabled(recognizing)
                if recognizing { ProgressView() }
                if let name = data.diagnosticName { Text(name).font(.caption) }
                if let file = data.diagnosticFile {
                    Button("Открыть исходный PDF") { do { originalPDF = SharedPDF(url: try DiagnosticImport.attachment(file)) } catch { message = error.localizedDescription } }
                    Button("Убрать PDF диагностики", role: .destructive) { data.diagnosticFile = nil; data.diagnosticName = nil; data.diagnosticText = nil }
                }
                if data.diagnosticText != nil {
                    DisclosureGroup("Исходный текст PDF — для проверки и исправлений") {
                        TextEditor(text: Binding(get: { data.diagnosticText ?? "" }, set: { data.diagnosticText = $0 })).frame(minHeight: 180)
                        Button("Обновить коды по тексту") { mergeFaults(DiagnosticImport.faults(from: data.diagnosticText ?? "")) }
                    }
                }
                if #available(iOS 18.0, *) { FaultTranslationView(faults: $data.faults, onError: { message = $0 }) }
                else { Text("Автоперевод доступен с iOS 18. На iOS 17 проверьте и исправьте описания вручную.").font(.caption).foregroundStyle(.secondary) }
                Text("До 10 МБ и 40 страниц. В отчёт включаются блок, код и описание из строки ошибки. Служебные строки исключаются. Проверьте результат по оригиналу.").font(.caption).foregroundStyle(.secondary)
            }
            Section("Ошибки до работ") {
                ForEach($data.faults) { $fault in
                    VStack(alignment: .leading) {
                        TextField("Код (например P0300)", text: $fault.code).textInputAutocapitalization(.characters)
                        TextField("Блок управления", text: Binding(get: { fault.block ?? "" }, set: { fault.block = $0 }))
                        TextField("Описание ошибки", text: $fault.description, axis: .vertical)
                        if let original = fault.originalDescription, original != fault.description { Text(original).font(.caption).foregroundStyle(.secondary) }
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
                if !saved.isEmpty { Text(LocalizedStringKey(saved)).font(.caption).foregroundStyle(.secondary).accessibilityIdentifier("saveStatus") }
            } footer: { Text("Черновик сохраняется автоматически после изменения и при уходе в фон. PDF доступен после проверки обязательных полей. VIN и госномер можно оставить пустыми.") }
        }
        .navigationTitle("Диагностический отчёт")
        .navigationBarTitleDisplayMode(.inline)
        .environment(\.locale, Locale(identifier: language))
        .preferredColorScheme(.dark)
        .tint(VehicleStyle.accent(data.brand ?? ""))
        .scrollContentBackground(.hidden)
        .background(LinearGradient(colors: [VehicleStyle.accent(data.brand ?? "").opacity(0.18), Color(red: 0.07, green: 0.08, blue: 0.09)], startPoint: .topLeading, endPoint: .bottomTrailing).ignoresSafeArea())
        .animation(.easeInOut(duration: 0.65), value: data.brand)
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
        .sheet(item: $originalPDF) { item in NavigationStack { PDFPreview(url: item.url).toolbar { Button("Закрыть") { originalPDF = nil } } } }
        .sheet(item: $picker) { kind in
            if kind == .brand {
                VehiclePicker(title: "Марка автомобиля", items: VehicleCatalog.brands) { brand in
                    if data.brand != brand { data.brand = brand; data.model = nil; data.bodyStyle = nil; data.vehicle = brand }
                }
            } else {
                VehiclePicker(title: "Модель автомобиля", items: VehicleCatalog.models[data.brand ?? ""] ?? [], children: data.brand == "BMW" ? VehicleCatalog.bodies : [:]) { model in data.model = model; data.vehicle = [data.brand ?? "", model].joined(separator: " ") }
            }
        }
        .fileImporter(isPresented: $importing, allowedContentTypes: [.pdf]) { result in
            switch result {
            case .success(let url): Task { await importPDF(url) }
            case .failure(let error): message = error.localizedDescription
            }
        }
        .task(id: data.vin) {
            guard VehicleCatalog.valid(VehicleCatalog.normalize(data.vin)) else {
                if let generatedVehicle, data.vehicle == generatedVehicle { data.brand = nil; data.model = nil; data.vehicle = ""; data.bodyStyle = nil; self.generatedVehicle = nil }
                return
            }
            do { try await Task.sleep(for: .milliseconds(500)) } catch { return }
            // Automatic lookup fills blank vehicle fields; explicit decode may replace manual input.
            if data.vehicle.isEmpty || data.vehicle == generatedVehicle { decodeVIN() }
        }
    }
    private func field(_ title: String, text: Binding<String>, id: String) -> some View {
        TextField(LocalizedStringKey(title), text: text).accessibilityIdentifier(id)
    }
    private func decodeVIN() {
        let vin = VehicleCatalog.normalize(data.vin)
        guard VehicleCatalog.valid(vin) else { vinStatus = language == "en" ? "Enter a valid 17-character VIN." : "Введите корректный VIN из 17 символов."; return }
        data.vin = vin
        if let match = VehicleCatalog.decode(vin) {
            data.brand = match.brand; data.model = match.model; data.vehicle = match.vehicle; data.bodyStyle = match.bodyStyle
            generatedVehicle = match.vehicle
            vinStatus = language == "en" ? "Found in local catalog. Check details before saving." : "Найдено в локальном каталоге. Проверьте данные перед сохранением."
        } else {
            if let generatedVehicle, data.vehicle == generatedVehicle { data.brand = nil; data.model = nil; data.vehicle = ""; data.bodyStyle = nil; self.generatedVehicle = nil }
            do {
                let records = try context.fetch(FetchDescriptor<DiagnosticReport>())
                let matches = records.compactMap { try? $0.read() }.filter { VehicleCatalog.normalize($0.vin) == vin && !$0.vehicle.isEmpty }
                if let saved = matches.first, Set(matches.map(\.modelIdentity)).count == 1 { data.brand = saved.brand; data.model = saved.model; data.vehicle = saved.vehicle; data.bodyStyle = saved.bodyStyle; generatedVehicle = saved.vehicle; vinStatus = language == "en" ? "Found in saved visits." : "Найдено в сохранённых посещениях."; return }
            } catch { message = error.localizedDescription; return }
            if let brand = VehicleCatalog.brand(for: vin), data.brand?.isEmpty != false { data.brand = brand }
            vinStatus = language == "en" ? "Not in the local catalog. Select make and model manually. VIN stays on this device." : "В локальном каталоге нет точной модели. Выберите вручную. VIN остаётся на устройстве."
        }
    }
    @MainActor private func importPDF(_ url: URL) async {
        recognizing = true; defer { recognizing = false }
        do {
            let result = try await DiagnosticImport.read(url)
            let filename = try DiagnosticImport.persist(url)
            data.diagnosticFile = filename; data.diagnosticName = url.lastPathComponent; data.diagnosticText = result.text
            mergeFaults(DiagnosticImport.faults(from: result.text))
            if result.usedOCR { message = language == "en" ? "OCR was used. Verify codes against the original PDF." : "Использовано OCR. Проверьте коды по оригиналу PDF." }
        } catch { message = error.localizedDescription }
    }
    private func mergeFaults(_ imported: [Fault]) {
        let keys = Set(data.faults.map { ($0.block ?? "") + "|" + $0.code.uppercased() })
        data.faults.append(contentsOf: imported.filter { !keys.contains(($0.block ?? "") + "|" + $0.code.uppercased()) }.prefix(max(0, 100 - data.faults.count)))
        if imported.isEmpty { message = language == "en" ? "No codes found. Review the extracted text." : "Коды не найдены. Проверьте извлечённый текст." }
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

struct PDFPreview: UIViewRepresentable {
    let url: URL
    func makeUIView(context: Context) -> PDFView { let view = PDFView(); view.autoScales = true; view.document = PDFDocument(url: url); return view }
    func updateUIView(_ view: PDFView, context: Context) { if view.document?.documentURL != url { view.document = PDFDocument(url: url) } }
}
