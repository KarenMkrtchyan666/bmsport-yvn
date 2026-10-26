import XCTest

final class BMSportUITests: XCTestCase {
    @MainActor func testCreateFindOpenAndExport() throws {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-testing"]
        app.launch()
        func reveal(_ element: XCUIElement) { for _ in 0..<18 { if element.isHittable { return }; app.swipeUp() } }
        app.buttons["Новый отчёт"].tap()
        func fill(_ id: String, _ value: String) {
            let field = app.textFields[id]
            reveal(field)
            field.tap(); field.typeText(value)
        }
        fill("client", "Test Client")
        fill("phone", "37499123456")
        fill("vehicle", "BMW X5")
        fill("year", "2020")
        app.swipeUp()
        fill("mileage", "120000")
        if app.buttons["Готово"].exists { app.buttons["Готово"].tap() }
        app.swipeUp(); app.swipeUp(); app.swipeUp()
        reveal(app.buttons["complete"]); app.buttons["complete"].tap()
        XCTAssertTrue(app.staticTexts["Отчёт сохранён"].waitForExistence(timeout: 5))
        app.buttons["Закрыть"].tap()
        let search = app.searchFields.firstMatch
        search.tap(); search.typeText("BMW X5")
        app.staticTexts["BMW X5"].firstMatch.tap()
        app.swipeUp(); app.swipeUp(); app.swipeUp()
        reveal(app.buttons["exportPDF"]); app.buttons["exportPDF"].tap()
        XCTAssertTrue(app.otherElements["ActivityListView"].waitForExistence(timeout: 5) || app.buttons["Copy"].exists || app.buttons["Скопировать"].exists)
    }
    @MainActor func testInvalidReportShowsValidation() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-testing"]; app.launch()
        app.buttons["Новый отчёт"].tap()
        app.swipeUp(); app.swipeUp(); app.swipeUp()
        for _ in 0..<18 { if app.buttons["complete"].isHittable { break }; app.swipeUp() }
        app.buttons["complete"].tap()
        XCTAssertTrue(app.alerts["BMSPORT YVN"].waitForExistence(timeout: 3))
    }
}
