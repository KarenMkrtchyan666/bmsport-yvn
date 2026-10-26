$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$script:counter = 0
function Id { $script:counter++; return $script:counter.ToString('X24') }
$objects = [System.Collections.Generic.List[string]]::new()
function Obj($id, $value) { $objects.Add("$id = { $value };") }
$project = Id; $main = Id; $products = Id
$projectConfig = Id; $pd = Id; $pr = Id
$targets = @(); $productRefs = @(); $groups = @(); $targetIds = @{}
foreach ($name in @('BMSport', 'BMSportTests', 'BMSportUITests')) { $targetIds[$name] = Id }
foreach ($name in @('BMSport', 'BMSportTests', 'BMSportUITests')) {
    $target = $targetIds[$name]; $group = Id; $product = Id; $sources = Id; $frameworks = Id; $resources = Id
    $configs = Id; $debug = Id; $release = Id
    $refs = @(); $builds = @()
    foreach ($file in Get-ChildItem -LiteralPath $name -Filter '*.swift' | Sort-Object Name) {
        $ref = Id; $build = Id; $refs += $ref; $builds += $build
        Obj $ref "isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = $($file.Name); sourceTree = `"<group>`";"
        Obj $build "isa = PBXBuildFile; fileRef = $ref;"
    }
    $isApp = $name -eq 'BMSport'
    $ext = if ($isApp) { 'app' } else { 'xctest' }
    $filetype = if ($isApp) { 'wrapper.application' } else { 'wrapper.cfbundle' }
    $productType = if ($isApp) { 'com.apple.product-type.application' } elseif ($name -eq 'BMSportTests') { 'com.apple.product-type.bundle.unit-test' } else { 'com.apple.product-type.bundle.ui-testing' }
    Obj $product "isa = PBXFileReference; explicitFileType = $filetype; includeInIndex = 0; path = $name.$ext; sourceTree = BUILT_PRODUCTS_DIR;"
    $resourceBuilds = @()
    if ($isApp) {
        foreach ($folder in @('Resources', 'en.lproj', 'ru.lproj')) {
            $resourceRef = Id; $resourceBuild = Id; $refs += $resourceRef; $resourceBuilds += $resourceBuild
            Obj $resourceRef "isa = PBXFileReference; lastKnownFileType = folder; path = $folder; sourceTree = `"<group>`";"
            Obj $resourceBuild "isa = PBXBuildFile; fileRef = $resourceRef;"
        }
    }
    Obj $group "isa = PBXGroup; children = ($($refs -join ',')); path = $name; sourceTree = `"<group>`";"
    Obj $sources "isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = ($($builds -join ',')); runOnlyForDeploymentPostprocessing = 0;"
    Obj $frameworks 'isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0;'
    Obj $resources "isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = ($($resourceBuilds -join ',')); runOnlyForDeploymentPostprocessing = 0;"
    $settings = 'CODE_SIGN_STYLE = Automatic; CURRENT_PROJECT_VERSION = 1; MARKETING_VERSION = 1.0; GENERATE_INFOPLIST_FILE = YES; IPHONEOS_DEPLOYMENT_TARGET = 17.0; SDKROOT = iphoneos; SUPPORTED_PLATFORMS = "iphoneos iphonesimulator"; SWIFT_VERSION = 5.0; TARGETED_DEVICE_FAMILY = "1,2"; PRODUCT_NAME = "$(TARGET_NAME)";'
    $settings += " PRODUCT_BUNDLE_IDENTIFIER = am.bmsport.yvn.$name;"
    $dependencies = ''
    if ($isApp) {
        $settings += ' INFOPLIST_KEY_CFBundleDisplayName = "BMSPORT YVN"; INFOPLIST_KEY_LSApplicationCategoryType = "public.app-category.business"; INFOPLIST_KEY_UILaunchScreen_Generation = YES; INFOPLIST_KEY_UIApplicationSceneManifest_Generation = YES; INFOPLIST_KEY_UISupportedInterfaceOrientations_iPhone = "UIInterfaceOrientationPortrait UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight";'
    } else {
        $proxy = Id; $dep = Id; $appTarget = $targetIds['BMSport']
        Obj $proxy "isa = PBXContainerItemProxy; containerPortal = $project; proxyType = 1; remoteGlobalIDString = $appTarget; remoteInfo = BMSport;"
        Obj $dep "isa = PBXTargetDependency; target = $appTarget; targetProxy = $proxy;"
        $dependencies = $dep
        if ($name -eq 'BMSportTests') { $settings += ' TEST_HOST = "$(BUILT_PRODUCTS_DIR)/BMSport.app/$(BUNDLE_EXECUTABLE_FOLDER_PATH)/BMSport"; BUNDLE_LOADER = "$(TEST_HOST)";' }
        else { $settings += ' TEST_TARGET_NAME = BMSport;' }
    }
    Obj $debug "isa = XCBuildConfiguration; buildSettings = { $settings SWIFT_OPTIMIZATION_LEVEL = `"-Onone`"; ENABLE_TESTABILITY = YES; }; name = Debug;"
    Obj $release "isa = XCBuildConfiguration; buildSettings = { $settings SWIFT_OPTIMIZATION_LEVEL = `"-O`"; }; name = Release;"
    Obj $configs "isa = XCConfigurationList; buildConfigurations = ($debug,$release); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;"
    Obj $target "isa = PBXNativeTarget; buildConfigurationList = $configs; buildPhases = ($sources,$frameworks,$resources); buildRules = (); dependencies = ($dependencies); name = $name; productName = $name; productReference = $product; productType = `"$productType`";"
    $targets += $target; $productRefs += $product; $groups += $group
}
Obj $products "isa = PBXGroup; children = ($($productRefs -join ',')); name = Products; sourceTree = `"<group>`";"
Obj $main "isa = PBXGroup; children = ($($groups -join ','),$products); sourceTree = `"<group>`";"
Obj $pd 'isa = XCBuildConfiguration; buildSettings = { CLANG_ENABLE_MODULES = YES; SWIFT_VERSION = 5.0; DEBUG_INFORMATION_FORMAT = dwarf; SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG; }; name = Debug;'
Obj $pr 'isa = XCBuildConfiguration; buildSettings = { CLANG_ENABLE_MODULES = YES; SWIFT_VERSION = 5.0; DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym"; }; name = Release;'
Obj $projectConfig "isa = XCConfigurationList; buildConfigurations = ($pd,$pr); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;"
Obj $project "isa = PBXProject; attributes = { BuildIndependentTargetsInParallel = YES; LastUpgradeCheck = 1600; }; buildConfigurationList = $projectConfig; compatibilityVersion = `"Xcode 14.0`"; developmentRegion = ru; hasScannedForEncodings = 0; knownRegions = (ru,en,hy,Base); mainGroup = $main; productRefGroup = $products; projectDirPath = `"`"; projectRoot = `"`"; targets = ($($targets -join ','));"
$utf8 = [System.Text.UTF8Encoding]::new($false)
[IO.File]::WriteAllText((Join-Path (Get-Location) 'BMSport.xcodeproj/project.pbxproj'), "// !`$*UTF8*`$!`n{ archiveVersion = 1; classes = {}; objectVersion = 56; objects = {`n$($objects -join "`n")`n}; rootObject = $project; }", $utf8)
$appId = $targetIds['BMSport']; $unitId = $targetIds['BMSportTests']; $uiId = $targetIds['BMSportUITests']
$scheme = @"
<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="1600" version="1.3">
 <BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="$appId" BuildableName="BMSport.app" BlueprintName="BMSport" ReferencedContainer="container:BMSport.xcodeproj"/></BuildActionEntry></BuildActionEntries></BuildAction>
 <TestAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv="YES"><Testables>
 <TestableReference skipped="NO"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="$unitId" BuildableName="BMSportTests.xctest" BlueprintName="BMSportTests" ReferencedContainer="container:BMSport.xcodeproj"/></TestableReference>
 <TestableReference skipped="NO"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="$uiId" BuildableName="BMSportUITests.xctest" BlueprintName="BMSportUITests" ReferencedContainer="container:BMSport.xcodeproj"/></TestableReference>
 </Testables></TestAction>
 <LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" debugServiceExtension="internal" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="$appId" BuildableName="BMSport.app" BlueprintName="BMSport" ReferencedContainer="container:BMSport.xcodeproj"/></BuildableProductRunnable></LaunchAction>
 <ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" savedToolIdentifier="" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"><BuildableProductRunnable runnableDebuggingMode="0"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="$appId" BuildableName="BMSport.app" BlueprintName="BMSport" ReferencedContainer="container:BMSport.xcodeproj"/></BuildableProductRunnable></ProfileAction>
 <AnalyzeAction buildConfiguration="Debug"/><ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>
"@
[IO.File]::WriteAllText((Join-Path (Get-Location) 'BMSport.xcodeproj/xcshareddata/xcschemes/BMSport.xcscheme'), $scheme, $utf8)
