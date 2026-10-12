package io.github.anthonylchoi.workcal;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * 웹 앱 ↔ 홈 화면 위젯 (js/widget.js).
 * 앱은 update로 위젯에 그릴 값을 넘기고, 위젯의 '지금 퇴근'은 punchOut 이벤트({date, time})로 받는다
 */
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    @Override
    public void load() {
        // 앱이 꺼져 있다가 '지금 퇴근'으로 켜진 경우
        handlePunchOut(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        // 앱이 떠 있는 동안 '지금 퇴근'을 누른 경우
        handlePunchOut(intent);
    }

    private void handlePunchOut(Intent intent) {
        if (intent == null || !WorkWidget.ACTION_PUNCH_OUT.equals(intent.getAction())) return;
        // 화면을 다시 만들 때 같은 버튼 입력을 두 번 기록하지 않게 지운다
        intent.setAction(Intent.ACTION_MAIN);
        Date now = new Date();
        JSObject data = new JSObject();
        data.put("date", new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(now));
        data.put("time", new SimpleDateFormat("HH:mm", Locale.US).format(now));
        // 웹 화면이 아직 안 떴으면 리스너가 붙을 때까지 붙잡아 둔다
        notifyListeners("punchOut", data, true);
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
