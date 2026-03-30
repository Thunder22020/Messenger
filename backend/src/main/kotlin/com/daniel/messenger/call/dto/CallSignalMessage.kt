package com.daniel.messenger.call.dto

data class CallSignalMessage(
    val callId: String,
    val type: String,
    val payload: String,
)
