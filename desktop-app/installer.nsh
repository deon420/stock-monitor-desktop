; Modern Stock Monitor Installer - Made by one person who cares
; Comprehensive working version with GUI improvements

; Global branding (must be at top level)
BrandingText "Made by one person who cares"

; Modern UI customization (all at top level to work properly)
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_NOAUTOCLOSE

; Custom welcome page
!define MUI_WELCOMEPAGE_TITLE "Welcome to Stock Monitor! 📈"
!define MUI_WELCOMEPAGE_TEXT "Welcome! Stock Monitor was crafted by one person, trying to bring you the best monitoring experience possible. Thank you for trying it!$\r$\n$\r$\nTrack the two things that matter most: price drops AND stock availability. Perfect for deal hunters and resellers who need to know the moment items come back in stock!"

; Custom directory page  
!define MUI_DIRECTORYPAGE_TEXT_TOP "We've picked a great spot for Stock Monitor. You can keep this default location or choose your own:"
!define MUI_DIRECTORYPAGE_TEXT_DESTINATION "Install Stock Monitor to:"

; Custom finish page
!define MUI_FINISHPAGE_TITLE "You're all set! 🎉"
!define MUI_FINISHPAGE_TEXT "Stock Monitor is now ready to help you track deals and stock availability. Thanks for supporting a solo developer!$\r$\n$\r$\nClick Finish to start monitoring those prices and inventory levels."

; Run checkbox handled automatically by electron-builder via runAfterFinish: true

; Custom uninstall confirmation
!define MUI_UNCONFIRMPAGE_TEXT_TOP "Sorry to see you go! Stock Monitor will be removed from your computer."
!define MUI_UNCONFIRMPAGE_TEXT_LOCATION "Stock Monitor will be uninstalled from the following folder. Click Uninstall to continue."

; Required macros (keep minimal and legal)
!macro preInit
!macroend

!macro customInit
!macroend

!macro customInstall
!macroend

!macro customUnInstall
!macroend

!macro customRemoveFiles
  ; Clean up app data folders
  RMDir /r "$APPDATA\Stock Monitor"  
  RMDir /r "$LOCALAPPDATA\Stock Monitor"
!macroend