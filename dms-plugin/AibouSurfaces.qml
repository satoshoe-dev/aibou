import QtQuick
import Quickshell
import Quickshell.Io
import qs.Common

// Tells Aibou where DMS has a surface open on the frame (popout, modal or
// launcher, notification, slideout), so he steps aside. DMS 2.0 lists them
// all in ConnectedModeState; under 1.6 there is no such list and
// dms-leiste-patch (section 13) writes the same file, so this stays off.
Item {
    id: root

    property string pluginId: ""
    property var pluginService: null

    readonly property bool active: typeof ConnectedModeState.surfaceDescriptorsOfKind === "function"

    // Aibou knows one surface at a time: the first open one in this order,
    // popouts first as under 1.6
    readonly property var kinds: ["popout", "slideout", "modal", "notification"]

    function isOpen(d) {
        if (!d || !d.visible || d.phase === "closing" || d.phase === "hidden")
            return false;
        const r = d.bodyRect;
        if (!r || r.width < 1 || r.height < 1)
            return false;
        // a slideout stays "open" while it slides in and out; it counts while
        // at least half of it is on screen
        if (d.kind === "slideout")
            return Math.abs(d.animationOffset ? d.animationOffset.x : 0) < r.width / 2;
        return true;
    }

    // "side x y w h screen ms" (screen coordinates, like the patch), or "zu".
    // ms is how long DMS takes to fold the surface out, so Aibou moves with it.
    // The report comes as the surface starts to open, the patch under 1.6 sent
    // it earlier and no ms. Reading the descriptors also follows their motion
    // while they animate.
    readonly property string stand: {
        if (!root.active)
            return "zu";
        ConnectedModeState.surfaceRevisions;
        const screens = Object.keys(ConnectedModeState.surfaceDescriptors || {});
        for (const kind of root.kinds) {
            for (const screen of screens) {
                for (const d of ConnectedModeState.surfaceDescriptorsOfKind(screen, kind)) {
                    if (!root.isOpen(d))
                        continue;
                    const r = d.bodyRect;
                    const ms = kind === "modal" ? Theme.modalAnimationDuration : Theme.popoutAnimationDuration;
                    return [d.barSide, Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height), screen, ms].join(" ");
                }
            }
        }
        return "zu";
    }

    property string written: ""

    function write() {
        if (!root.active || root.stand === root.written)
            return;
        root.written = root.stand;
        file.setText(root.stand + "\n");
    }

    // several changes in one frame make one write
    onStandChanged: Qt.callLater(root.write)
    // a DMS that died with a popout open left its last state behind
    Component.onCompleted: root.write()

    FileView {
        id: file
        path: root.active ? (Quickshell.env("XDG_RUNTIME_DIR") || "/tmp") + "/aibou-popout" : ""
        blockWrites: false
        atomicWrites: true
        printErrors: false
    }
}
