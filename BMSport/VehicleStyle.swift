import SwiftUI

enum VehicleStyle {
    struct Logo: Decodable { let name, logo: String }
    static let logos = VehicleCatalog.resource("brand-logos", as: [String: Logo].self) ?? [:]
    static func key(_ value: String) -> String { value.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "en")).filter { $0.isASCII && $0.isLetter || $0.isNumber }.lowercased() }
    static func logo(_ brand: String) -> UIImage? {
        guard let item = logos[key(brand)] else { return nil }
        return UIImage(contentsOfFile: Bundle.main.bundlePath + "/Resources" + item.logo)
    }
    static func accent(_ brand: String) -> Color {
        switch key(brand) {
        case "bmw", "ford", "volkswagen": return Color(red: 0.60, green: 0.75, blue: 1)
        case "mercedesbenz", "audi": return Color(red: 0.78, green: 0.83, blue: 0.88)
        case "toyota", "mazda": return Color(red: 0.94, green: 0.63, blue: 0.67)
        case "landrover", "mini", "skoda": return Color(red: 0.69, green: 0.80, blue: 0.69)
        default: return Color(red: 0.79, green: 0.73, blue: 0.63)
        }
    }
    static func slogan(_ brand: String) -> String {
        ["bmw":"Sheer Driving Pleasure", "mercedesbenz":"The best or nothing", "audi":"Vorsprung durch Technik", "porsche":"There is no substitute", "toyota":"Let’s Go Places", "ford":"Built Ford Proud", "lexus":"Experience Amazing"][key(brand)] ?? ""
    }
}

struct BrandIdentityView: View {
    let brand: String
    var body: some View {
        HStack(spacing: 15) {
            if let logo = VehicleStyle.logo(brand) { Image(uiImage: logo).resizable().scaledToFit().frame(width: 58, height: 46).accessibilityHidden(true) }
            VStack(alignment: .leading, spacing: 5) {
                Text(brand).font(.headline)
                if !VehicleStyle.slogan(brand).isEmpty { Text(VehicleStyle.slogan(brand)).font(.caption).foregroundStyle(.secondary) }
            }
        }.padding(.vertical, 8).id(brand).transition(.opacity)
    }
}

struct VehiclePhotoView: View {
    let brand: String
    let model: String
    @State private var url: URL?
    @State private var attribution = ""
    @State private var source: URL?
    @State private var status = ""
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let url {
                AsyncImage(url: url) { image in image.resizable().scaledToFit() } placeholder: { ProgressView() }.frame(maxWidth: .infinity, maxHeight: 220)
            }
            BrandIdentityView(brand: brand)
            Text("Внешний вид модели").font(.caption).foregroundStyle(.secondary)
            Text([brand, model].joined(separator: " ")).font(.headline)
            Text("Справочное фото. Поколение, цвет и комплектация могут отличаться.").font(.caption).foregroundStyle(.secondary)
            if let source { Link(attribution, destination: source).font(.caption2) }
            if !status.isEmpty { Text(status).font(.caption).foregroundStyle(.secondary) }
        }.task(id: brand + "|" + model) { await load() }
    }
    @MainActor private func load() async {
        url = nil; source = nil; attribution = ""; status = ""
        guard !brand.isEmpty, !model.isEmpty else { return }
        // No VIN or customer fields leave the device. Only public make/model names.
        guard !(brand + " " + model).contains(where: { $0.isNewline }), (brand + " " + model).range(of: "[A-HJ-NPR-Z0-9]{17}", options: [.regularExpression, .caseInsensitive]) == nil else { return }
        let code = model.components(separatedBy: " · ").dropFirst().first ?? ""
        let base = model.components(separatedBy: " · ")[0].replacingOccurrences(of: "серия", with: "Series")
        let query = code.isEmpty ? base : brand == "BMW" ? "\(base) (\(code))" : code
        var components = URLComponents(string: "https://carapi.trustcar.info/getImage")!
        components.queryItems = [URLQueryItem(name: "make", value: brand), URLQueryItem(name: "model", value: query), URLQueryItem(name: "format", value: "json")]
        do {
            var request = URLRequest(url: components.url!); request.timeoutInterval = 10
            let (data, response) = try await URLSession.shared.data(for: request)
            try Task.checkCancellation()
            guard (response as? HTTPURLResponse)?.statusCode == 200, let object = try JSONSerialization.jsonObject(with: data) as? [String: Any], object["found"] as? Bool == true, let image = object["image_url"] as? String, let photo = URL(string: image), photo.scheme == "https", ["cdn.trustcar.info", "carapi.trustcar.info", "upload.wikimedia.org"].contains(photo.host ?? ""), let license = object["license"] as? String, !license.isEmpty, let title = object["title"] as? String else { status = "Фото не найдено"; return }
            guard code.isEmpty || title.range(of: "\\b" + NSRegularExpression.escapedPattern(for: code) + "\\b", options: [.regularExpression, .caseInsensitive]) != nil else { status = "Фото не найдено"; return }
            url = photo; attribution = (object["attribution"] as? String) ?? "\(title) / \(license)"
            if let reference = object["reference"] as? String, reference.range(of: "^Q[0-9]+$", options: .regularExpression) != nil { source = URL(string: "https://www.wikidata.org/wiki/\(reference)") }
            else { source = URL(string: "https://carapi.trustcar.info/") }
        } catch is CancellationError { } catch { if !Task.isCancelled { status = "Фото временно недоступно" } }
    }
}

struct VehiclePicker: View {
    let title: String
    let items: [String]
    var children: [String: [String]] = [:]
    let select: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var series: String?
    var body: some View {
        NavigationStack {
            List {
                if let series { Button("← Все модели") { self.series = nil; query = "" }; Text(series).font(.caption).foregroundStyle(.secondary) }
                ForEach(options.filter { query.isEmpty || $0.localizedStandardContains(query) }, id: \.self) { value in
                    Button { if children[value] != nil && series == nil { series = value; query = "" } else { select(value); dismiss() } } label: {
                        HStack { Text(value); Spacer(); if children[value] != nil && series == nil { Image(systemName: "chevron.right") } }
                    }
                }
                if !query.trimmingCharacters(in: .whitespaces).isEmpty { Button("Использовать введённое значение") { select(query); dismiss() } }
            }.searchable(text: $query).navigationTitle(Text(title))
                .toolbar { Button("Закрыть") { dismiss() } }
        }
    }
    private var options: [String] { if let series { return (children[series] ?? []).map { "\(series) · \($0)" } }; return items }
}
