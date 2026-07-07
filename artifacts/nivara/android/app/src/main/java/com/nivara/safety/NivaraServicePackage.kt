package com.nivara.safety
import com.facebook.react.ReactPackage; import com.facebook.react.bridge.*; import com.facebook.react.uimanager.ViewManager
class NivaraServicePackage : ReactPackage {
    override fun createNativeModules(ctx: ReactApplicationContext): List<NativeModule> = listOf(NivaraServiceModule(ctx))
    override fun createViewManagers(ctx: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}