; Modern Stock Monitor Installer - Sleek & Personal
; Made with care by one developer who wants installations to feel special!

; ===============================
; MODERN UI STYLING & THEMING
; ===============================

; Modern colors - Dark theme with clean aesthetics
!define MUI_BGCOLOR "1E1E1E"
!define MUI_TEXTCOLOR "FFFFFF"

; Remove Windows 98 vibes - Clean modern look
BrandingText "Made by one person who cares"
!define MUI_UI_HEADERIMAGE_RIGHT
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_UNBITMAP_NOSTRETCH

; Modern welcome page styling
!define MUI_WELCOMEFINISHPAGE_BITMAP_NOSTRETCH
!define MUI_UNWELCOMEFINISHPAGE_BITMAP_NOSTRETCH

; Clean up installer appearance
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_NOAUTOCLOSE

; ===============================
; CUSTOM MACRO IMPLEMENTATIONS  
; ===============================

; Branding and initial setup
!macro preInit
  ; Set modern branding
  BrandingText "Made by one person who cares"
  
  ; Modern installer behavior
  SetCompressor /SOLID lzma
  SetCompressorDictSize 32
  SetDatablockOptimize on
!macroend

; Custom header content for modern feel
!macro customHeader
  ; Set modern UI constants
  !define MUI_WELCOMEPAGE_TITLE "Welcome to Stock Monitor! 📈"
  !define MUI_WELCOMEPAGE_TEXT "Welcome! Stock Monitor was crafted by one person, trying to bring you the best monitoring experience possible. Thank you for trying it!$\r$\n$\r$\nTrack the two things that matter most: price drops AND stock availability. Perfect for deal hunters and resellers who need to know the moment items come back in stock!"
  
  ; Directory page customization
  !define MUI_DIRECTORYPAGE_TEXT_TOP "We've picked a great spot for Stock Monitor. You can keep this default location or choose your own:"
  !define MUI_DIRECTORYPAGE_TEXT_DESTINATION "Install Stock Monitor to:"
  
  ; Installation progress styling
  !define MUI_INSTFILESPAGE_FINISHHEADER_TEXT "Almost there!"
  !define MUI_INSTFILESPAGE_FINISHHEADER_SUBTEXT "Stock Monitor is being set up on your computer."
  
  ; Finish page customization
  !define MUI_FINISHPAGE_TITLE "You're all set! 🎉"
  !define MUI_FINISHPAGE_TEXT "Stock Monitor is now ready to help you track deals and stock availability. Thanks for supporting a solo developer!$\r$\n$\r$\nClick Finish to start monitoring those prices and inventory levels."
  
  ; Auto-launch settings
  !define MUI_FINISHPAGE_RUN "$INSTDIR\Stock Monitor.exe"
  !define MUI_FINISHPAGE_RUN_TEXT "Launch Stock Monitor now"
  !define MUI_FINISHPAGE_RUN_CHECKED
!macroend

; Modern installation process
!macro customInstall
  ; Show a friendly welcome during installation
  DetailPrint "Setting up Stock Monitor for you..."
  
  ; Create modern shortcuts with better descriptions
  CreateShortcut "$DESKTOP\Stock Monitor.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 SW_SHOWNORMAL ALT|CONTROL|SHIFT|F1 "Track Amazon & Walmart prices with Stock Monitor"
  
  ; Add to Windows Programs and Features with proper metadata
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}" "DisplayName" "Stock Monitor"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}" "Publisher" "Made by one person who cares"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}" "DisplayIcon" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}" "HelpLink" "https://github.com/user/stock-monitor"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}" "URLInfoAbout" "https://github.com/user/stock-monitor"
  
  DetailPrint "Stock Monitor is ready! 🎉"
!macroend

; Friendly uninstall process
!macro customUnInstall
  ; Clean uninstall with personality
  MessageBox MB_YESNO|MB_ICONQUESTION "Thanks for trying Stock Monitor! 💫$\r$\n$\r$\nHope it helped you catch some great deals. Remove it from your system?" IDYES DoUninstall IDNO DontUninstall
  
  DoUninstall:
    DetailPrint "Removing Stock Monitor..."
    ; Clean up custom shortcuts
    Delete "$DESKTOP\Stock Monitor.lnk"
    ; Clean up registry entries
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}"
    DetailPrint "Thanks for using Stock Monitor! 👋"
    Return
  
  DontUninstall:
    DetailPrint "Stock Monitor will stay on your system 😊"
    Quit
!macroend

; Modern initialization
!macro customInit
  ; Show that this is a personal project
  Banner::show "Loading..." "Stock Monitor by one person who cares..."
  Sleep 1000
  Banner::destroy
!macroend

; ===============================
; UNINSTALLER CUSTOMIZATION
; ===============================

; Custom uninstall confirmation page
!macro customUninstallMode
  !define MUI_UNCONFIRMPAGE_TEXT_TOP "Sorry to see you go! Stock Monitor will be removed from your computer."
  !define MUI_UNCONFIRMPAGE_TEXT_LOCATION "Stock Monitor will be uninstalled from the following folder. Click Uninstall to continue."
!macroend

; Final cleanup
!macro customRemoveFiles
  ; Remove any leftover files that might have been created
  RMDir /r "$APPDATA\Stock Monitor"
  RMDir /r "$LOCALAPPDATA\Stock Monitor"
!macroend