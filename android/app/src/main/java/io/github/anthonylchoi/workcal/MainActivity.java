package io.github.anthonylchoi.workcal;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 앱 안에 둔 플러그인은 super.onCreate 전에 등록해야 웹 화면에서 부를 수 있다
        registerPlugin(WidgetBridgePlugin.class);
        super.onCreate(savedInstanceState);
        // 뒤로가기: 웹 화면에 돌아갈 곳(설정 → 달력)이 있으면 웹에서 되돌리고, 없으면 원래대로 앱을 닫는다
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView web = getBridge() == null ? null : getBridge().getWebView();
                if (web != null && web.canGoBack()) {
                    web.goBack();
                    return;
                }
                setEnabled(false);
                getOnBackPressedDispatcher().onBackPressed();
                setEnabled(true);
            }
        });
    }
}
