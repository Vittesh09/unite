package com.unite.astronomy;

import android.graphics.Bitmap;
import android.graphics.Color;

import java.util.Calendar;
import java.util.Locale;
import java.util.TimeZone;

/** Synodic moon phase helpers + bitmap renderer for the home-screen widget. */
public final class MoonPhase {
    private static final double SYNODIC_DAYS = 29.530588853;
    private static final long NEW_MOON_UTC_MS = 947182440000L; // 2000-01-06 18:14 UTC

    private MoonPhase() {}

    public static final class Info {
        public final double phase;
        public final double illumination;
        public final String name;
        public final int illuminationPercent;

        Info(double phase, double illumination, String name) {
            this.phase = phase;
            this.illumination = illumination;
            this.name = name;
            this.illuminationPercent = (int) Math.round(illumination * 100.0);
        }
    }

    public static Info forNow() {
        return forDate(System.currentTimeMillis());
    }

    public static Info forDate(long epochMs) {
        double days = (epochMs - NEW_MOON_UTC_MS) / 86400000.0;
        double age = ((days % SYNODIC_DAYS) + SYNODIC_DAYS) % SYNODIC_DAYS;
        double phase = age / SYNODIC_DAYS;
        double illum = (1.0 - Math.cos(phase * 2.0 * Math.PI)) / 2.0;
        int idx = ((int) Math.round(phase * 8.0)) % 8;
        String[] names = {
            "New Moon", "Waxing Crescent", "First Quarter", "Waxing Gibbous",
            "Full Moon", "Waning Gibbous", "Last Quarter", "Waning Crescent"
        };
        return new Info(phase, illum, names[idx]);
    }

    public static String todayLabel() {
        Calendar cal = Calendar.getInstance(TimeZone.getDefault());
        return String.format(
            Locale.US,
            "%s %d",
            cal.getDisplayName(Calendar.MONTH, Calendar.SHORT, Locale.getDefault()),
            cal.get(Calendar.DAY_OF_MONTH)
        );
    }

    /**
     * Static disc using the same sun direction as the in-app 3D moon (Lambert sphere).
     * Waxing lights the right limb (northern view). No interaction.
     */
    public static Bitmap renderDisc(int sizePx, double phase) {
        Bitmap bmp = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888);
        int[] pixels = new int[sizePx * sizePx];
        double cx = (sizePx - 1) / 2.0;
        double cy = (sizePx - 1) / 2.0;
        double radius = sizePx * 0.42;
        double angle = phase * 2.0 * Math.PI;
        double lx = Math.sin(angle);
        double ly = 0.12;
        double lz = -Math.cos(angle);
        double len = Math.sqrt(lx * lx + ly * ly + lz * lz);
        if (len == 0) len = 1;
        lx /= len;
        ly /= len;
        lz /= len;
        double[][] craters = {
            {0.22, -0.18, 0.11},
            {-0.28, 0.12, 0.09},
            {0.08, 0.30, 0.14},
            {-0.12, -0.32, 0.07},
            {0.34, 0.16, 0.06},
            {-0.34, -0.08, 0.08},
            {0.02, 0.02, 0.05}
        };
        for (int y = 0; y < sizePx; y++) {
            for (int x = 0; x < sizePx; x++) {
                double dx = (x - cx) / radius;
                double dy = (y - cy) / radius;
                double d2 = dx * dx + dy * dy;
                if (d2 > 1.0) {
                    pixels[y * sizePx + x] = Color.TRANSPARENT;
                    continue;
                }
                double nz = Math.sqrt(Math.max(0.0, 1.0 - d2));
                double nx = dx;
                double ny = -dy;
                double ndotl = Math.max(0.0, nx * lx + ny * ly + nz * lz);
                double shade = Math.pow(ndotl, 0.85);
                double albedo = 0.82 + 0.18 * nz;
                for (double[] crater : craters) {
                    double crx = dx - crater[0];
                    double cry = dy - crater[1];
                    double crr = crater[2];
                    double cd = (crx * crx + cry * cry) / (crr * crr);
                    if (cd < 1.0) albedo *= 0.72 + 0.28 * cd;
                }
                double litR = 255.0 * albedo;
                double litG = 243.0 * albedo;
                double litB = 220.0 * albedo;
                double nightR = 18.0 + 16.0 * nz;
                double nightG = 16.0 + 14.0 * nz;
                double nightB = 14.0 + 12.0 * nz;
                int r = clampByte(nightR + (litR - nightR) * shade);
                int g = clampByte(nightG + (litG - nightG) * shade);
                int b = clampByte(nightB + (litB - nightB) * shade);
                pixels[y * sizePx + x] = Color.argb(255, r, g, b);
            }
        }
        bmp.setPixels(pixels, 0, sizePx, 0, 0, sizePx, sizePx);
        return bmp;
    }

    private static int clampByte(double value) {
        return Math.max(0, Math.min(255, (int) Math.round(value)));
    }
}
