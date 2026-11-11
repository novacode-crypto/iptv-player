/**
 * Lista de demostración opcional: flujos HLS de prueba públicos publicados por
 * sus proveedores para validar reproductores. Solo se añade si el usuario lo pide.
 */
export const DEMO_M3U = `#EXTM3U
#EXTINF:-1 tvg-id="demo.bbb" tvg-name="Big Buck Bunny" tvg-logo="" group-title="Películas",Big Buck Bunny (Prueba HLS)
https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8
#EXTINF:-1 tvg-id="demo.sintel" tvg-name="Sintel" group-title="Películas",Sintel (Prueba HLS)
https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8
#EXTINF:-1 tvg-id="demo.tos" tvg-name="Tears of Steel" group-title="Películas",Tears of Steel (Prueba HLS)
https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8
#EXTINF:-1 tvg-id="demo.apple" tvg-name="Apple Advanced" group-title="Documentales",Apple Advanced Stream (Prueba HLS)
https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8
#EXTINF:-1 tvg-id="demo.live" tvg-name="Live Test" group-title="Entretenimiento",Directo de prueba (HLS)
https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8
`;
