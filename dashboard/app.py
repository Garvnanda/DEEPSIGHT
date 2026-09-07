"""Deep-Sight backend tester (Streamlit).

Run:  .venv/Scripts/python -m streamlit run dashboard/app.py
Point BASE_URL at the running API (default http://localhost:8000).

Exercises every apiendpoints.md route + the two pseudo-survey helpers, so the backend
can be checked before the frontend is wired.
"""

from __future__ import annotations

import asyncio
import io
import json

import numpy as np
import requests
import streamlit as st

try:
    import cv2
except Exception:  # noqa: BLE001
    cv2 = None

st.set_page_config(page_title="Deep-Sight backend tester", layout="wide")

CLASS_COLOR = {"wreck": (255, 60, 60), "milco": (255, 200, 0),
               "nombo": (0, 180, 255), "pipeline": (0, 255, 120)}


# --------------------------------------------------------------------------- helpers
def api(base: str):
    def _call(method: str, path: str, **kw):
        r = requests.request(method, base.rstrip("/") + path, timeout=120, **kw)
        return r
    return _call


def show_json(r: requests.Response):
    st.caption(f"HTTP {r.status_code}  ·  {r.request.method} {r.url}")
    try:
        st.json(r.json())
    except ValueError:
        st.text(r.text[:2000])


def overlay_boxes(png_bytes: bytes, dets: list[dict], y_offset: int) -> np.ndarray:
    arr = np.frombuffer(png_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
    img = cv2.cvtColor(img, cv2.COLOR_GRAY2RGB)
    h = img.shape[0]
    for d in dets:
        b = d["bbox_px"]
        y = b["y"] - y_offset
        if y + b["h"] < 0 or y > h:
            continue
        c = CLASS_COLOR.get(d["class"], (255, 255, 255))
        cv2.rectangle(img, (b["x"], y), (b["x"] + b["w"], y + b["h"]), c, 2)
        cv2.putText(img, f"{d['class']} {d['confidence']:.2f}", (b["x"], max(12, y - 4)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, c, 1)
    return img


# --------------------------------------------------------------------------- sidebar
st.sidebar.title("Deep-Sight")
base = st.sidebar.text_input("BASE_URL", "http://localhost:8000")
call = api(base)

try:
    h = call("GET", "/health")
    st.sidebar.success(f"health: {h.json().get('status')}")
except Exception as exc:  # noqa: BLE001
    st.sidebar.error(f"no API at {base}\n{exc}")
    st.stop()

if st.sidebar.button("Refresh survey list"):
    st.session_state.pop("surveys", None)
if "surveys" not in st.session_state:
    st.session_state["surveys"] = call("GET", "/api/surveys").json().get("surveys", [])
surveys = st.session_state["surveys"]
labels = [f"{s['survey_id']}  ·  {s['filename']}  ({s['status']}, {s['ping_count']} pings)"
          for s in surveys]
pick = st.sidebar.selectbox("survey", range(len(labels)),
                            format_func=lambda i: labels[i]) if labels else None
sid = surveys[pick]["survey_id"] if pick is not None else None

st.sidebar.markdown("---")
st.sidebar.subheader("make a survey")
up_xtf = st.sidebar.file_uploader("XTF file", type=["xtf", "XTF"])
if up_xtf and st.sidebar.button("upload XTF"):
    show_json(call("POST", "/api/surveys", files={"file": (up_xtf.name, up_xtf.getvalue())}))
    st.session_state.pop("surveys", None)
up_imgs = st.sidebar.file_uploader("sonar images", type=["png", "jpg", "jpeg"],
                                   accept_multiple_files=True)
if up_imgs and st.sidebar.button("upload images"):
    files = [("files", (f.name, f.getvalue())) for f in up_imgs]
    show_json(call("POST", "/api/surveys/image", files=files))
    st.session_state.pop("surveys", None)
if st.sidebar.button("create demo survey (SSS tiles)"):
    show_json(call("POST", "/api/dev/demo-survey"))
    st.session_state.pop("surveys", None)


# --------------------------------------------------------------------------- main
if sid is None:
    st.info("No surveys. Upload an XTF, upload images, or create the demo survey (sidebar).")
    st.stop()

st.header(sid)
tabs = st.tabs(["Overview", "Waterfall", "Detections", "Track & Stats", "Report", "Playback", "Raw GET"])

with tabs[0]:
    c1, c2 = st.columns(2)
    with c1:
        st.subheader("GET /api/surveys/{id}")
        show_json(call("GET", f"/api/surveys/{sid}"))
    with c2:
        st.subheader("GET /status")
        show_json(call("GET", f"/api/surveys/{sid}/status"))
        if st.button("POST /process  (run detection)"):
            show_json(call("POST", f"/api/surveys/{sid}/process"))
        if st.button("poll status once"):
            show_json(call("GET", f"/api/surveys/{sid}/status"))

with tabs[1]:
    det = call("GET", f"/api/surveys/{sid}").json()
    n = det.get("ping_count", 0)
    start = st.slider("start_ping", 0, max(0, n - 1), 0, step=64)
    count = st.slider("count", 64, 2048, min(1024, n), step=64)
    corrected = st.checkbox("corrected (slant-range)")
    boxes = st.checkbox("overlay detections", value=True)
    r = call("GET", f"/api/surveys/{sid}/waterfall",
             params={"start_ping": start, "count": count, "corrected": str(corrected).lower()})
    st.caption(f"HTTP {r.status_code} · {len(r.content)} bytes")
    if r.status_code == 200:
        if boxes and cv2 is not None:
            dets = call("GET", f"/api/surveys/{sid}/detections").json().get("detections", [])
            st.image(overlay_boxes(r.content, dets, start), use_container_width=True)
        else:
            st.image(r.content, use_container_width=True)

with tabs[2]:
    c1, c2, c3 = st.columns(3)
    cls = c1.selectbox("class", ["(any)", "wreck", "milco", "nombo", "pipeline"])
    minc = c2.slider("min_confidence", 0.0, 1.0, 0.0, 0.05)
    srt = c3.selectbox("sort", ["ping", "confidence", "error_radius"])
    params = {"min_confidence": minc, "sort": srt}
    if cls != "(any)":
        params["class"] = cls
    r = call("GET", f"/api/surveys/{sid}/detections", params=params)
    j = r.json()
    st.caption(f"HTTP {r.status_code} · count {j.get('count')}")
    dets = j.get("detections", [])
    if dets:
        st.dataframe([{k: d[k] for k in ("detection_id", "class", "confidence", "ping",
                                         "channel", "bbox_m_width", "lat", "lon",
                                         "error_radius_m")} for d in dets],
                     use_container_width=True)
        did = st.selectbox("detail for", [d["detection_id"] for d in dets])
        if did:
            show_json(call("GET", f"/api/detections/{did}"))

with tabs[3]:
    c1, c2 = st.columns([2, 1])
    with c1:
        st.subheader("GET /track")
        tr = call("GET", f"/api/surveys/{sid}/track").json()
        coords = tr.get("geometry", {}).get("coordinates", [])
        st.caption(f"{tr.get('properties', {})}")
        if coords:
            st.map([{"lat": c[1], "lon": c[0]} for c in coords[::max(1, len(coords) // 2000)]])
    with c2:
        st.subheader("GET /stats")
        s = call("GET", f"/api/surveys/{sid}/stats").json()
        st.metric("targets", s.get("targets_flagged"))
        st.metric("area m2", s.get("area_surveyed_m2"))
        st.write(s.get("headline"))
        st.json(s)

with tabs[4]:
    st.subheader("GET /report.json")
    show_json(call("GET", f"/api/surveys/{sid}/report.json"))
    r = call("GET", f"/api/surveys/{sid}/report.csv")
    st.download_button("download report.csv", r.content, file_name=f"{sid}_report.csv",
                       mime="text/csv")
    st.code(r.text[:3000] or "(empty)")

with tabs[5]:
    st.subheader("WS /ws/surveys/{id}/playback")
    secs = st.slider("collect for (s)", 2, 20, 6)
    speed = st.slider("speed", 1.0, 64.0, 32.0)
    if st.button("connect & collect"):
        import websockets

        async def run():
            uri = base.replace("http", "ws").rstrip("/") + f"/ws/surveys/{sid}/playback"
            got: dict = {}
            det_ids, first = [], None
            async with websockets.connect(uri, max_size=None) as ws:
                await ws.send(json.dumps({"type": "start", "start_ping": 0,
                                          "speed": speed, "batch_size": 64}))
                try:
                    while True:
                        m = json.loads(await asyncio.wait_for(ws.recv(), timeout=secs))
                        got[m["type"]] = got.get(m["type"], 0) + 1
                        if m["type"] == "detection":
                            det_ids.append(m["detection"]["detection_id"])
                        if m["type"] == "ping_batch" and first is None:
                            first = {k: m[k] for k in ("start_ping", "count", "width", "encoding")}
                        if m["type"] == "done":
                            break
                except asyncio.TimeoutError:
                    pass
            return got, first, det_ids

        got, first, det_ids = asyncio.new_event_loop().run_until_complete(run())
        st.write("message counts:", got)
        st.write("first ping_batch:", first)
        st.write(f"detection messages: {len(det_ids)}")

with tabs[6]:
    p = st.text_input("GET path", f"/api/surveys/{sid}")
    if st.button("send"):
        show_json(call("GET", p))
