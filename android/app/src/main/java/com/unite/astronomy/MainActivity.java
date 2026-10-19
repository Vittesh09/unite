package com.unite.astronomy;

import android.os.Bundle;
import android.webkit.ValueCallback;
import androidx.activity.OnBackPressedCallback;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MoonWidgetPlugin.class);
        // Theme.SplashScreen stays forever unless installSplashScreen runs.
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
        MoonPhaseWidgetProvider.refreshAll(this);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (getBridge() == null || getBridge().getWebView() == null) {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                    setEnabled(true);
                    return;
                }
                getBridge().getWebView().evaluateJavascript(
                    "(function(){try{if(typeof window.__uniteHandleBack==='function'){return window.__uniteHandleBack()?true:false;}return false;}catch(e){return true;}})()",
                    new ValueCallback<String>() {
                        @Override
                        public void onReceiveValue(String value) {
                            // JS returns true when navigation was handled; false to leave the app.
                            if ("false".equals(value)) {
                                finish();
                            }
                        }
                    }
                );
            }
        });
    }
}
