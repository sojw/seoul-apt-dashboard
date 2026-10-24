// 서비스 워커. 홈 화면 설치 조건을 채우고, 뉴스 업데이트 푸시를 받아 띄운다.
// fetch 를 가로채지 않는다 — 아무것도 캐시하지 않으므로 화면과 데이터(매일·매시 바뀐다)는 늘 네트워크에서 받는다.
// 캐시를 넣고 싶어지면 json 은 빼야 한다. 옛 시총·뉴스가 뜨는 것이 오프라인보다 나쁘다.
self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });

// push.py 는 데이터만 담아 보낸다(webpush.data: title·body·url·tag). FCM 이 감싸 오는 모양이 경로마다
// 조금 달라 data 안팎을 다 본다. 아이폰은 받은 푸시마다 알림을 반드시 띄워야 한다(안 띄우면 구독이 끊긴다).
// 홈 화면 앱 아이콘 배지 = 알림 센터에 남은 우리 알림 수(2026-10-23). 같은 tag 는 앞 알림을 바꾸므로
// 숫자는 보통 1~2 다. 아이폰(16.4+ 설치 앱)·PC 설치 앱만 숫자를 보이고, 안드로이드는 런처가 점을 찍는다.
// 지원하지 않으면 조용히 넘어간다 — 배지 실패가 알림 표시를 막으면 안 된다.
function syncBadge(){
  if (!self.navigator || !self.navigator.setAppBadge) return Promise.resolve();
  return self.registration.getNotifications().then(function(list){
    return list.length ? self.navigator.setAppBadge(list.length) : self.navigator.clearAppBadge();
  }).catch(function(){});
}

self.addEventListener('push', function(e){
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data && e.data.text() }; }
  var m = d.data || (d.notification ? Object.assign({}, d.notification, d.data) : d);
  e.waitUntil(self.registration.showNotification(m.title || '서울 아파트 증시', {
    body: m.body || '뉴스판이 새로 묶였습니다',
    icon: 'icon-192.png', badge: 'icon-192.png',
    tag: m.tag || 'news',              // 같은 tag 는 앞 알림을 바꾼다 — 안 본 알림이 쌓이지 않게
    data: { url: m.url || './#news' }
  }).then(syncBadge));
});

// 누르면 같은 오리진의 열린 창을 앞으로 가져와 뉴스로 옮기고, 없거나 옮기기에 실패하면 새로 연다.
// navigate() 는 이 워커가 제어하지 않는 창(includeUncontrolled 로 잡힌 창)이면 거절되고, 다른 오리진으로
// 가면 null 을 준다 — 그때 아무 창도 안 뜨지 않게 openWindow 로 넘어간다.
self.addEventListener('notificationclick', function(e){
  e.notification.close();
  syncBadge();                         // 누른 알림이 빠진 수로 다시 맞춘다(앱이 열리면 화면이 지운다)
  var url = new URL((e.notification.data && e.notification.data.url) || './#news', self.registration.scope).href;
  var origin = new URL(url).origin;
  var open = function(){ return self.clients.openWindow(url); };
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list){
    var c = null;
    for (var i = 0; i < list.length && !c; i++) {
      try { if (new URL(list[i].url).origin === origin && 'focus' in list[i]) c = list[i]; } catch (err) {}
    }
    if (!c) return open();
    return Promise.resolve(c.focus()).then(function(f){
      var w = f || c;
      if (w.url === url) return w;
      if (!('navigate' in w)) return open();
      return w.navigate(url).then(function(n){ return n || open(); });
    }).catch(open);
  }));
});
