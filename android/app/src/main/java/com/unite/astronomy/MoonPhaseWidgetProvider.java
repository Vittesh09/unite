package com.unite.astronomy;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.widget.RemoteViews;

/** Home-screen moon phase widget. */
public class MoonPhaseWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, id);
        }
    }

    @Override
    public void onEnabled(Context context) {
        refreshAll(context);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent != null ? intent.getAction() : null;
        if (Intent.ACTION_BOOT_COMPLETED.equals(action)
            || Intent.ACTION_TIME_CHANGED.equals(action)
            || Intent.ACTION_TIMEZONE_CHANGED.equals(action)
            || Intent.ACTION_DATE_CHANGED.equals(action)) {
            refreshAll(context);
        }
    }

    public static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName name = new ComponentName(context, MoonPhaseWidgetProvider.class);
        int[] ids = manager.getAppWidgetIds(name);
        if (ids == null || ids.length == 0) return;
        for (int id : ids) {
            updateAppWidget(context, manager, id);
        }
    }

    static void updateAppWidget(Context context, AppWidgetManager manager, int appWidgetId) {
        MoonPhase.Info info = MoonPhase.forNow();
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_moon_phase);

        int size = (int) (120f * context.getResources().getDisplayMetrics().density);
        Bitmap disc = MoonPhase.renderDisc(size, info.phase);
        views.setImageViewBitmap(R.id.widget_moon_disc, disc);
        views.setTextViewText(R.id.widget_moon_name, info.name);
        views.setTextViewText(R.id.widget_moon_illum, info.illuminationPercent + "% lit · " + MoonPhase.todayLabel());
        views.setTextViewText(R.id.widget_moon_date, "");

        Intent launch = new Intent(context, MainActivity.class);
        launch.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(
            context,
            appWidgetId,
            launch,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_moon_root, pending);

        manager.updateAppWidget(appWidgetId, views);
    }
}
