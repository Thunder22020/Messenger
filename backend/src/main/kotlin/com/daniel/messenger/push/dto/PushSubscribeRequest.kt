package com.daniel.messenger.push.dto

data class PushSubscribeRequest(
    val endpoint: String,
    val p256dh: String,
    val auth: String,
)
