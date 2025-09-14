; Modern Stock Monitor Installer - Full NSIS Script
; Made by one person who cares

Unicode True
RequestExecutionLevel admin
Caption "Stock Monitor Installer 1.0.0"
Name "Stock Monitor"
OutFile "StockMonitor-Setup-1.0.0.exe"  
InstallDir "$PROGRAMFILES64\Stock Monitor"
SetShellVarContext all

; Modern UI
!include "MUI2.nsh"
!include "LogicLib.nsh"

; Modern UI Theme Settings
!define MUI_UI "${NSISDIR}\Contrib\UIs\modern.exe"
!define MUI_BGCOLOR "FFFFFF"
!define MUI_TEXTCOLOR "000000"

; Branding
BrandingText "Made by one person who cares"

; Modern UI Configuration - BEFORE page declarations
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_NOAUTOCLOSE

; Custom welcome page text - APPLIED BEFORE PAGE CREATION
!define MUI_WELCOMEPAGE_TITLE "Welcome to Stock Monitor! 📈"
!define MUI_WELCOMEPAGE_TEXT "Welcome! Stock Monitor was crafted by one person, trying to bring you the best monitoring experience possible. Thank you for trying it!$\r$\n$\r$\nTrack the two things that matter most: price drops AND stock availability. Perfect for deal hunters and resellers who need to know the moment items come back in stock!"

; Custom directory page with default location
!define MUI_DIRECTORYPAGE_TEXT_TOP "Stock Monitor will be installed to the following folder. To install in a different folder, click Browse and select another folder. Click Next to continue."
!define MUI_DIRECTORYPAGE_TEXT_DESTINATION "Destination Folder"

; Custom finish page - APPLIED BEFORE PAGE CREATION  
!define MUI_FINISHPAGE_TITLE "You're all set! 🎉"
!define MUI_FINISHPAGE_TEXT "Stock Monitor is now ready to help you track deals and stock availability. Thanks for supporting a solo developer!$\r$\n$\r$\nClick Finish to start monitoring those prices and inventory levels."

; Custom uninstall text
!define MUI_UNCONFIRMPAGE_TEXT_TOP "Sorry to see you go! Stock Monitor will be removed from your computer."
!define MUI_UNCONFIRMPAGE_TEXT_LOCATION "Stock Monitor will be uninstalled from the following folder. Click Uninstall to continue."

; Pages - electron-builder will inject these automatically with our custom text
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; Uninstaller pages
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; Languages
!insertmacro MUI_LANGUAGE "English"

; Installation section - electron-builder handles the actual files
Section "Install"
  ; Set default install directory
  StrCmp $INSTDIR "" 0 +2
    StrCpy $INSTDIR "$PROGRAMFILES64\Stock Monitor"
  
  ; electron-builder injects app installation here
SectionEnd

; Uninstaller section
Section "Uninstall"
  ; Clean up app data folders
  RMDir /r "$APPDATA\Stock Monitor"  
  RMDir /r "$LOCALAPPDATA\Stock Monitor"
SectionEnd