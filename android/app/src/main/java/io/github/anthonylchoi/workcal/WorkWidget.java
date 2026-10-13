package io.github.anthonylchoi.workcal;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * 4x4 홈 화면 위젯: 위에 이번 달 요약(월·필수·초과, 하루 평균), 가운데 달력, 맨 아래 고른 날(기본 오늘)의 상세.
 * 근무일 칸을 한 번 누르면 그날을 고르고(앱을 열지 않고 다시 그린다), 고른 칸을 또 누르거나 상세 칸을 누르면
 * 앱에서 그날 입력 시트를 연다. 연·월 제목은 앱을 열고, 그 밖의 빈 곳·주말·공휴일은 오늘로 돌아간다.
 * 계산은 하지 않고 앱(js/widget.js)이 넘긴 글자를 그린다. 30분마다 다시 그려 날짜가 바뀌면 그날 줄을 고른다.
 * 크기 조절은 막고 4x4(이 클래스)와 5x5(WorkWidget5, 글씨 1.25배) 두 위젯을 따로 둔다.
 */
public class WorkWidget extends AppWidgetProvider {
    static final String ACTION_OPEN_DATE = "io.github.anthonylchoi.workcal.OPEN_DATE";
    static final String EXTRA_DATE = "date";
    private static final String ACTION_SELECT = "io.github.anthonylchoi.workcal.SELECT_DATE";
    private static final String PREFS = "workcal.widget";
    private static final String KEY = "data";
    private static final String KEY_SELECTED = "selected";
    /** 위젯 크기에 따라 키우는 글씨: {뷰 id, 4x4일 때 sp} (달력 칸 글씨는 fill에서) */
    private static final int[][] TEXT_SIZES = {
        {R.id.widget_title, 16}, {R.id.widget_required_label, 12}, {R.id.widget_required, 18},
        {R.id.widget_overtime_label, 12}, {R.id.widget_overtime, 18}, {R.id.widget_average, 12},
        {R.id.widget_wd0, 11}, {R.id.widget_wd1, 11}, {R.id.widget_wd2, 11}, {R.id.widget_wd3, 11},
        {R.id.widget_wd4, 11}, {R.id.widget_wd5, 11}, {R.id.widget_wd6, 11},
        {R.id.widget_detail_info, 13}, {R.id.widget_detail_sub, 11},
        {R.id.widget_detail_right, 15}, {R.id.widget_detail_edit, 15},
    };

    /** 앱이 넘긴 값을 저장하고 고른 날을 오늘로 되돌려 놓인 위젯을 모두 다시 그린다 */
    static void save(Context context, String json) {
        prefs(context).edit().putString(KEY, json).remove(KEY_SELECTED).apply();
        redraw(context);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        // 30분마다 다시 그릴 때도 오늘로 돌아간다
        prefs(context).edit().remove(KEY_SELECTED).apply();
        for (int id : ids) manager.updateAppWidget(id, build(context, scale()));
    }

    /** 4x4 글씨에 곱할 배율. 5x5 위젯(WorkWidget5)이 1.25로 바꾼다 */
    protected float scale() {
        return 1f;
    }

    /** 위젯 안에서 날짜를 고르거나(EXTRA_DATE) 빈 곳을 눌러 오늘로 돌아간다(날짜 없음) */
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!ACTION_SELECT.equals(intent.getAction())) {
            super.onReceive(context, intent);
            return;
        }
        prefs(context).edit().putString(KEY_SELECTED, intent.getStringExtra(EXTRA_DATE)).apply();
        redraw(context);
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** 놓인 4x4·5x5 위젯을 모두 다시 그린다 (고른 날은 둘이 함께 쓴다) */
    private static void redraw(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (WorkWidget widget : new WorkWidget[] {new WorkWidget(), new WorkWidget5()}) {
            RemoteViews views = null;
            for (int id : manager.getAppWidgetIds(new ComponentName(context, widget.getClass()))) {
                if (views == null) views = build(context, widget.scale());
                manager.updateAppWidget(id, views);
            }
        }
    }

    private static void setTextSize(RemoteViews views, int viewId, float sp) {
        views.setTextViewTextSize(viewId, TypedValue.COMPLEX_UNIT_SP, sp);
    }

    private static RemoteViews build(Context context, float scale) {
        String json = prefs(context).getString(KEY, null);
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_work);
        views.setOnClickPendingIntent(R.id.widget_title, openApp(context, Intent.ACTION_MAIN, null, 0));
        // 빈 곳(배경·요약 글자·빈 칸·주말·공휴일)은 오늘로 돌아간다
        PendingIntent reset = select(context, null, 300);
        views.setOnClickPendingIntent(R.id.widget_root, reset);
        views.setOnClickPendingIntent(R.id.widget_detail, reset);
        for (int[] size : TEXT_SIZES) setTextSize(views, size[0], size[1] * scale);
        views.removeAllViews(R.id.widget_calendar);
        try {
            if (json == null) throw new JSONException("no data");
            fill(context, views, new JSONObject(json), prefs(context).getString(KEY_SELECTED, null), reset, scale);
        } catch (JSONException e) {
            views.setTextViewText(R.id.widget_average, context.getString(R.string.widget_empty));
            views.setViewVisibility(R.id.widget_detail_edit, View.GONE);
        }
        return views;
    }

    private static void fill(Context context, RemoteViews views, JSONObject data, String selected,
            PendingIntent reset, float scale) throws JSONException {
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        views.setTextViewText(R.id.widget_title, data.getString("title"));
        views.setTextViewText(R.id.widget_required, data.getString("required"));
        views.setTextViewText(R.id.widget_overtime, data.getString("overtime"));
        int sign = data.getInt("overtimeSign");
        setTextColor(context, views, R.id.widget_overtime,
                sign > 0 ? R.color.widget_blue : sign < 0 ? R.color.widget_red : R.color.widget_text);
        // 달이 바뀌었는데 앱을 아직 안 열었으면 지난달 값이므로 앱을 열라고 알린다
        views.setTextViewText(R.id.widget_average,
                data.getJSONObject("daily").optString(today, context.getString(R.string.widget_stale)));

        JSONArray cells = data.getJSONArray("cells");
        // 상세 칸에 보일 날: 고른 날, 없거나 이번 달이 아니면 오늘 (달이 지났으면 비운다)
        JSONObject shown = findCell(cells, selected);
        if (shown == null) {
            selected = null;
            shown = findCell(cells, today);
        }
        showDetail(context, views, shown);

        int offset = data.getInt("offset");
        int slots = (offset + cells.length() + 6) / 7 * 7;
        RemoteViews row = null;
        for (int i = 0; i < slots; i++) {
            if (i % 7 == 0) row = new RemoteViews(context.getPackageName(), R.layout.widget_row);
            RemoteViews cell = new RemoteViews(context.getPackageName(), R.layout.widget_cell);
            setTextSize(cell, R.id.widget_day, 13 * scale);
            setTextSize(cell, R.id.widget_hours, 10 * scale);
            int index = i - offset;
            if (index >= 0 && index < cells.length()) {
                JSONObject c = cells.getJSONObject(index);
                String kind = c.getString("kind");
                cell.setTextViewText(R.id.widget_day, String.valueOf(c.getInt("day")));
                setTextColor(context, cell, R.id.widget_day, kindColor(kind));
                // 둘째 줄: 근무시간(8h보다 많으면 파랑, 적으면 빨강) 또는 연차·D-Day
                cell.setTextViewText(R.id.widget_hours, c.optString("text"));
                setTextColor(context, cell, R.id.widget_hours, toneColor(c.optString("tone")));
                // 근무일(연차·D-Day 포함)만 고를 수 있다: 채운 타일. 주말·공휴일은 테두리만이고 누르면 오늘로.
                // 고른 칸을 또 누르면 입력 시트. 날짜마다 요청 번호를 달리해야 서로 덮어쓰지 않는다
                String date = c.getString("date");
                boolean tappable = isTappable(c);
                boolean picked = tappable && date.equals(selected);
                cell.setOnClickPendingIntent(R.id.widget_cell, !tappable ? reset
                        : picked ? openApp(context, ACTION_OPEN_DATE, date, 100 + c.getInt("day"))
                        : select(context, date, 200 + c.getInt("day")));
                boolean isToday = today.equals(date);
                int background = picked
                        ? (isToday ? R.drawable.widget_today_selected : R.drawable.widget_cell_selected)
                        : isToday ? R.drawable.widget_today
                        : tappable ? R.drawable.widget_cell_fill : R.drawable.widget_cell_outline;
                cell.setInt(R.id.widget_cell, "setBackgroundResource", background);
            } else {
                cell.setOnClickPendingIntent(R.id.widget_cell, reset);
            }
            row.addView(R.id.widget_row, cell);
            if (i % 7 == 6) views.addView(R.id.widget_calendar, row);
        }
    }

    private static JSONObject findCell(JSONArray cells, String date) throws JSONException {
        for (int i = 0; date != null && i < cells.length(); i++) {
            if (cells.getJSONObject(i).getString("date").equals(date)) return cells.getJSONObject(i);
        }
        return null;
    }

    /** 연차·D-Day를 포함한 근무일만 고르고 입력할 수 있다 */
    private static boolean isTappable(JSONObject cell) throws JSONException {
        String kind = cell.getString("kind");
        return kind.equals("work") || kind.equals("leave");
    }

    /** 맨 아래 상세 칸. 근무일이면 눌러서 그날 입력 시트를 연다 (아니면 build에서 건 오늘로 돌아가기가 남는다) */
    private static void showDetail(Context context, RemoteViews views, JSONObject cell) throws JSONException {
        views.setTextViewText(R.id.widget_detail_info, cell == null ? "" : cell.optString("info"));
        views.setTextViewText(R.id.widget_detail_sub, cell == null ? "" : cell.optString("infoSub"));
        views.setTextViewText(R.id.widget_detail_right, cell == null ? "" : cell.optString("infoRight"));
        boolean editable = cell != null && isTappable(cell);
        views.setViewVisibility(R.id.widget_detail_edit, editable ? View.VISIBLE : View.GONE);
        if (!editable) return;
        setTextColor(context, views, R.id.widget_detail_right, toneColor(cell.optString("tone")));
        views.setOnClickPendingIntent(R.id.widget_detail,
                openApp(context, ACTION_OPEN_DATE, cell.getString("date"), 99));
    }

    private static int toneColor(String tone) {
        switch (tone) {
            case "over": return R.color.widget_blue;
            case "under": return R.color.widget_red;
            case "leave": return R.color.widget_leave;
            default: return R.color.widget_muted;
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

    /** 위젯 안에서 날짜를 고른다. date가 null이면 오늘로 돌아간다 */
    private static PendingIntent select(Context context, String date, int requestCode) {
        Intent intent = new Intent(context, WorkWidget.class).setAction(ACTION_SELECT);
        if (date != null) intent.putExtra(EXTRA_DATE, date);
        return PendingIntent.getBroadcast(context, requestCode, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent openApp(Context context, String action, String date, int requestCode) {
        Intent intent = new Intent(context, MainActivity.class).setAction(action)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        if (date != null) intent.putExtra(EXTRA_DATE, date);
        return PendingIntent.getActivity(context, requestCode, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
