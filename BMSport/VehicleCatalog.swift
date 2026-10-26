import Foundation

enum VehicleCatalog {
    struct Production: Decodable { let code, brand, model, chassis, body: String }
    struct ProductionList: Decodable { let results: [Production] }
    struct Mercedes: Decodable { let series, trim, chassis, bodyStyle: String }
    struct Match { let brand, model, vehicle, bodyStyle: String }
    static func resource<T: Decodable>(_ name: String, as type: T.Type) -> T? {
        guard let url = Bundle.main.url(forResource: name, withExtension: "json", subdirectory: "Resources"), let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }
    static let brands = resource("brands", as: [String].self) ?? []
    static let models = resource("models", as: [String: [String]].self) ?? [:]
    static let bodies = resource("bmw-bodies", as: [String: [String]].self) ?? [:]
    static let production = resource("bmw-production-codes", as: ProductionList.self)?.results ?? []
    static let mercedes = resource("mercedes-types", as: [String: Mercedes].self) ?? [:]
    static func normalize(_ vin: String) -> String { vin.filter { !$0.isWhitespace }.uppercased() }
    static func valid(_ vin: String) -> Bool { vin.range(of: "^[A-HJ-NPR-Z0-9]{17}$", options: .regularExpression) != nil }
    static func brand(for vin: String) -> String? {
        let makes = ["WBA":"BMW", "WBS":"BMW", "WBY":"BMW", "WBX":"BMW", "4US":"BMW", "5UX":"BMW", "5UM":"BMW", "5YM":"BMW", "3MW":"BMW", "WMW":"MINI", "WMZ":"MINI", "SCA":"Rolls-Royce", "WDB":"Mercedes-Benz", "WDD":"Mercedes-Benz", "W1K":"Mercedes-Benz", "WDC":"Mercedes-Benz", "W1N":"Mercedes-Benz"]
        return makes[String(vin.prefix(3))]
    }
    static func decode(_ input: String) -> Match? {
        let vin = normalize(input)
        guard valid(vin), let brand = brand(for: vin) else { return nil }
        if brand == "Mercedes-Benz", let item = mercedes[String(vin.dropFirst(3).prefix(6))] {
            return Match(brand: brand, model: "\(item.series) · \(item.chassis)", vehicle: "\(brand) \(item.trim) · \(item.chassis)", bodyStyle: item.bodyStyle)
        }
        let matches = production.filter { $0.code == String(vin.dropFirst(3).prefix(4)) && $0.brand == brand }
        guard matches.count == 1, let item = matches.first else { return nil }
        let chassis = String(item.chassis.prefix(3))
        let series = bodies.keys.sorted().first { bodies[$0]?.contains(chassis) == true } ?? item.model
        return Match(brand: brand, model: "\(series) · \(chassis)", vehicle: "\(brand) \(item.model) · \(chassis)", bodyStyle: item.body)
    }
}
