# Gelişmiş Discord Destek Botu

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![discord.js](https://img.shields.io/badge/discord.js-v14-blue)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

Bu proje, discord.js v14 kullanılarak geliştirilmiş kapsamlı bir Discord destek botudur.

## Özellikler

- Seçim menülü destek paneli
- Kategori bazlı özel ticket oluşturma
- Embed tabanlı log sistemi
- Ticket kapatıldığında otomatik yorum ve puan talebi (DM)
- Yetkililer için ticket üstlenme sistemi
- Ticket içerisinden tek tuşla kullanıcı yönetimi
- Ticket kapanışında otomatik transkript oluşturma
- Kapanış sonrası kullanıcıdan yorum ve puan alma
- Yetkililer için manuel embed DM gönderme komutu

## Kurulum

1. Bağımlılıkları yükleyin:
npm install

2. .env dosyasını ayarlayın:
DISCORD_TOKEN=bot-token-buraya
CLIENT_ID=uygulama-client-id
GUILD_ID=test-sunucu-id

3. Botu başlatın:
npm start

## Discord İçinde Kullanım

- /kurulum komutu ile kategori, log kanalı ve yetkili rolünü ayarlayın
- /panel komutu ile destek panelini gönderin
- Kullanıcı panelden kategori seçtiğinde bot otomatik ticket açar
- Yetkililer ticketı üstlenebilir, kullanıcı yönetebilir veya kapatabilir
- Ticket kapandığında log kanalına transkript gönderilir ve kullanıcıya DM ile puanlama isteği iletilir

## Notlar

- Kullanıcının DM’leri açık olmalıdır
- Otomatik DM sadece ticket kapanışında gönderilir
- Ticket kanalları belirlenen kategori altında oluşturulur
- Log kanalı bir metin kanalı olmalıdır

## Katkı

Pull request göndererek katkıda bulunabilirsiniz
