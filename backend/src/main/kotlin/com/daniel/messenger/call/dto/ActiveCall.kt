package com.daniel.messenger.call.dto

import com.daniel.messenger.call.enum.CallStatus
import java.time.Instant

data class ActiveCall(
    val callId: String,
    val chatId: Long,
    val callerId: Long,
    val callerUsername: String,
    val receiverId: Long,
    val receiverUsername: String,
    val status: CallStatus,
    val startedAt: Instant?,
    val initiatedAt: Instant,
)
