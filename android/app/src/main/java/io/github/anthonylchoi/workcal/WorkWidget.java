package io.github.anthonylchoi.workcal;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * 4x4 홈 화면 위젯: 위에 이번 달 요약, 아래에 달력, 맨 아래 '지금 퇴근' 버튼.
 * 계산은 하지 않고 앱(js/widget.js)이 넘긴 글자를 그린다. 30분마다 다시 그려 날짜가 바뀌면 그날 줄을 고른다
 */
public class WorkWidget extends AppWidgetProvider {
    static final String ACTION_PUNCH_OUT = "io.github.anthonylchoi.workcal.PUNCH_OUT";
    private static final String PREFS = "workcal.widget";
    private static final String KEY = "data";

    /** 앱이 넘긴 값을 저장하고 놓인 위젯을 모두 다시 그린다 */
    static void save(Context context, String json) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, json).apply();
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (int id : manager.getAppWidgetIds(new ComponentName(context, WorkWidget.class))) {
            manager.updateAppWidget(id, build(context, json));
        }
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        String json = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null);
        for (int id : ids) manager.updateAppWidget(id, build(context, json));
    }

    private static RemoteViews build(Context context, String json) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_work);
        views.setOnClickPendingIntent(R.id.widget_root, openApp(context, Intent.ACTION_MAIN, 0));
        views.setOnClickPendingIntent(R.id.widget_punch, openApp(context, ACTION_PUNCH_OUT, 1));
        views.removeAllViews(R.id.widget_calendar);
        try {
            if (json == null) throw new JSONException("no data");
            fill(context, views, new JSONObject(json));
        } catch (JSONException e) {
            views.setTextViewText(R.id.widget_average, context.getString(R.string.widget_empty));
        }
        return views;
    }

    private static void fill(Context context, RemoteViews views, JSONObject data) throws JSONException {
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        views.setTextViewText(R.id.widget_title, data.getString("title"));
        views.setTextViewText(R.id.widget_overtime, data.getString("overtime"));
        int sign = data.getInt("overtimeSign");
        setTextColor(context, views, R.id.widget_overtime,
                sign > 0 ? R.color.widget_blue : sign < 0 ? R.color.widget_red : R.color.widget_text);
        views.setTextViewText(R.id.widget_filled, data.getString("filled"));
        views.setProgressBar(R.id.widget_bar, 100, Math.min(100, data.getInt("percent")), false);
        // 달이 바뀌었는데 앱을 아직 안 열었으면 지난달 값이므로 앱을 열라고 알린다
        views.setTextViewText(R.id.widget_average,
                data.getJSONObject("daily").optString(today, context.getString(R.string.widget_stale)));

        JSONArray cells = data.getJSONArray("cells");
        int offset = data.getInt("offset");
        int slots = (offset + cells.length() + 6) / 7 * 7;
        RemoteViews row = null;
        for (int i = 0; i < slots; i++) {
            if (i % 7 == 0) row = new RemoteViews(context.getPackageName(), R.layout.widget_row);
            RemoteViews cell = new RemoteViews(context.getPackageName(), R.layout.widget_cell);
            int index = i - offset;
            if (index >= 0 && index < cells.length()) {
                JSONObject c = cells.getJSONObject(index);
                cell.setTextViewText(R.id.widget_cell, String.valueOf(c.getInt("day")));
                setTextColor(context, cell, R.id.widget_cell, kindColor(c.getString("kind")));
                if (today.equals(c.getString("date"))) {
                    cell.setInt(R.id.widget_cell, "setBackgroundResource", R.drawable.widget_today);
                }
            }
            row.addView(R.id.widget_row, cell);
            if (i % 7 == 6) views.addView(R.id.widget_calendar, row);
        }
    }

    private static int kindColor(String kind) {
        switch (kind) {
            case "red": return R.color.widget_red;
            case "sat": return R.color.widget_blue;
            case "leave": return R.color.widget_leave;
            default: return R.color.widget_text;
        }
    }

    /** Android 12+는 색 리소스를 넘겨 다크 모드 전환을 바로 따르게 한다 */
    private static void setTextColor(Context context, RemoteViews views, int viewId, int colorRes) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            views.setColorStateList(viewId, "setTextColor", colorRes);
        } else {
            views.setTextColor(viewId, context.getColor(colorRes));
        }
    }

    private static PendingIntent openApp(Context context, String action, int requestCode) {
        Intent intent = new Intent(context, MainActivity.class).setAction(action)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(context, requestCode, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
