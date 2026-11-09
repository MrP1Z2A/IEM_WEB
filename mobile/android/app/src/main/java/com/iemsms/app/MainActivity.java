package com.iemsms.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

// The app's only screen. Capacitor opens https://iemsms.com inside it
// (see capacitor.config.json); IemAndroidPlugin adds downloads, links and the Back button.
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(IemAndroidPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
