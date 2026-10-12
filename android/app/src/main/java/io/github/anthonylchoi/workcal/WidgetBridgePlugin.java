package io.github.anthonylchoi.workcal;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 웹 앱 ↔ 홈 화면 위젯 (js/widget.js).
 * 앱은 update로 위젯에 그릴 값을 넘기고, 위젯에서 누른 날짜는 openDate 이벤트({date})로 받는다
 */
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    @Override
    public void load() {
        // 앱이 꺼져 있다가 위젯 날짜로 켜진 경우
        handleOpenDate(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        // 앱이 떠 있는 동안 위젯 날짜를 누른 경우
        handleOpenDate(intent);
    }

    private void handleOpenDate(Intent intent) {
        if (intent == null || !WorkWidget.ACTION_OPEN_DATE.equals(intent.getAction())) return;
        String date = intent.getStringExtra(WorkWidget.EXTRA_DATE);
        // 화면을 다시 만들 때 같은 날짜를 또 열지 않게 지운다
        intent.setAction(Intent.ACTION_MAIN);
        if (date == null) return;
        JSObject data = new JSObject();
        data.put("date", date);
        // 웹 화면이 아직 안 떴으면 리스너가 붙을 때까지 붙잡아 둔다
        notifyListeners("openDate", data, true);
    }

    @PluginMethod
    public void update(PluginCall call) {
        String data = call.getString("data");
        if (data == null) {
            call.reject("data가 없습니다");
            return;
        }
        WorkWidget.save(getContext(), data);
        call.resolve();
    }
}
