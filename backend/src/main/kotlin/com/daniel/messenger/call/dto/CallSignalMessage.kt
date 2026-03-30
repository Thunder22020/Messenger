package com.daniel.messenger.call.dto

data class CallSignalMessage(
    val callId: String,
    val type: SignalType,
    val payload: String,
)

enum class SignalType { OFFER, ANSWER, ICE_CANDIDATE }
