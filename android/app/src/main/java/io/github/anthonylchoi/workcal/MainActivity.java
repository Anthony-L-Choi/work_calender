package io.github.anthonylchoi.workcal;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 앱 안에 둔 플러그인은 super.onCreate 전에 등록해야 웹 화면에서 부를 수 있다
        registerPlugin(WidgetBridgePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
