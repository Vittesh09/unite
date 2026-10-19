package com.unite.astronomy;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "MoonWidget")
public class MoonWidgetPlugin extends Plugin {
    @PluginMethod
    public void refresh(PluginCall call) {
        Context context = getContext();
        MoonPhaseWidgetProvider.refreshAll(context);
        call.resolve();
    }

    @PluginMethod
    public void isPinSupported(PluginCall call) {
        JSObject out = new JSObject();
        boolean supported = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            && AppWidgetManager.getInstance(getContext()).isRequestPinAppWidgetSupported();
        out.put("supported", supported);
        call.resolve(out);
    }

    @PluginMethod
    public void pin(PluginCall call) {
        Context context = getContext();
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName provider = new ComponentName(context, MoonPhaseWidgetProvider.class);

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || !manager.isRequestPinAppWidgetSupported()) {
            call.reject("Pinning widgets is not supported on this launcher. Long-press the home screen and add the Unite moon widget.");
            return;
        }

        Intent pinned = new Intent(context, MoonPhaseWidgetProvider.class);
        pinned.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
        PendingIntent success = PendingIntent.getBroadcast(
            context,
            0,
            pinned,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        boolean requested = manager.requestPinAppWidget(provider, null, success);
        if (!requested) {
            call.reject("Could not open the add-widget prompt. Try long-pressing your home screen.");
            return;
        }

        MoonPhaseWidgetProvider.refreshAll(context);
        JSObject out = new JSObject();
        out.put("requested", true);
        call.resolve(out);
    }
}
