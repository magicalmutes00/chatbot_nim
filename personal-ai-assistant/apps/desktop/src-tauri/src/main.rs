use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    webview::{NewWindowResponse, WebviewWindowBuilder},
    Manager, WebviewUrl, WindowEvent,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

/// Ctrl+Shift+Space — show/hide Aurora from anywhere.
fn toggle_shortcut() -> Shortcut {
    Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Space)
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn toggle_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        match window.is_visible() {
            Ok(true) if window.is_focused().unwrap_or(false) => {
                let _ = window.hide();
            }
            _ => show_main_window(app),
        }
    }
}

fn main() {
    let accelerator = toggle_shortcut();
    let handler_accelerator = accelerator.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    if shortcut == &handler_accelerator && event.state() == ShortcutState::Pressed {
                        toggle_main_window(app);
                    }
                })
                .build(),
        )
        .setup(move |app| {
            // WebView2 cancels every `window.open` unless the webview installs a
            // new-window handler; Tauri only does that for windows it builds
            // itself, not for ones declared in tauri.conf.json. Firebase's
            // Google sign-in needs that popup (its redirect flow cannot hand the
            // credential back inside WebView2), so the main window is created
            // here with popups allowed.
            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Aurora")
                .inner_size(1200.0, 800.0)
                .min_inner_size(720.0, 520.0)
                .on_new_window(|_url, _features| NewWindowResponse::Allow)
                .build()?;

            // Global hotkey: Ctrl+Shift+Space toggles the window.
            if let Err(err) = app.global_shortcut().register(accelerator.clone()) {
                eprintln!("[aurora] could not register Ctrl+Shift+Space: {err}");
            }

            let show = MenuItem::with_id(app, "show", "Show Aurora", true, Some("Ctrl+Shift+Space"))?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            let mut tray = TrayIconBuilder::with_id("main")
                .tooltip("Aurora AI Assistant")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                });

            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }

            tray.build(app)?;
            Ok(())
        })
        // Closing the window keeps Aurora alive in the tray.
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
