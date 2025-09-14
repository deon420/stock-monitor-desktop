; Modern Stock Monitor Installer - Inno Setup 6 Script
; This creates a beautiful Windows 11-style installer

#define MyAppName "Stock Monitor"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Made by one person who cares"
#define MyAppURL "https://stockmonitor.app"
#define MyAppExeName "Stock Monitor.exe"

[Setup]
; App identity
AppId={{C6990F9D-1431-5148-93A4-202B207332CC}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}

; Installation settings  
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
LicenseFile=
PrivilegesRequired=admin
OutputDir=dist
OutputBaseFilename=StockMonitor-Setup-{#MyAppVersion}
SetupIconFile=
Compression=lzma
SolidCompression=yes

; Modern Windows 11 style
WizardStyle=modern
WizardResizable=no
DisableProgramGroupPage=yes
DisableWelcomePage=no

; Welcome and finish customization
WizardImageFile=compiler:WizModernImage-IS.bmp
WizardSmallImageFile=compiler:WizModernSmallImage-IS.bmp

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[CustomMessages]
WelcomeLabel2=Welcome! Stock Monitor was crafted by one person, trying to bring you the best monitoring experience possible. Thank you for trying it!%n%nTrack the two things that matter most: price drops AND stock availability. Perfect for deal hunters and resellers who need to know the moment items come back in stock!

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: checked

[Files]
Source: "dist\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[Code]
procedure InitializeWizard;
begin
  // Custom welcome message  
  WizardForm.WelcomeLabel2.Caption := ExpandConstant('{cm:WelcomeLabel2}');
  WizardForm.WelcomeLabel2.Height := 100;
end;