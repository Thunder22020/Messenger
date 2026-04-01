package com.daniel.messenger.call.controller

import com.daniel.messenger.call.dto.InitiateCallRequest
import com.daniel.messenger.call.dto.InitiateCallResponse
import com.daniel.messenger.call.dto.TurnCredentialsResponse
import com.daniel.messenger.call.service.CallService
import com.daniel.messenger.call.service.TurnService
import com.daniel.messenger.security.userdetails.UserPrincipal
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/call")
class CallController(
    private val callService: CallService,
    private val turnService: TurnService,
) {

    @GetMapping("/turn-credentials")
    fun getTurnCredentials(
        @AuthenticationPrincipal userPrincipal: UserPrincipal,
    ): TurnCredentialsResponse =
        turnService.generateCredentials(requireNotNull(userPrincipal.user.id))

    @PostMapping("/initiate")
    fun initiateCall(
        @RequestBody request: InitiateCallRequest,
        @AuthenticationPrincipal userPrincipal: UserPrincipal,
    ): InitiateCallResponse {
        val userId = requireNotNull(userPrincipal.user.id)
        return callService.initiateCall(userId, request.chatId, request.video)
    }

    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PostMapping("/{callId}/accept")
    fun acceptCall(
        @PathVariable callId: String,
        @AuthenticationPrincipal userPrincipal: UserPrincipal,
    ) {
        callService.acceptCall(callId, requireNotNull(userPrincipal.user.id))
    }

    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PostMapping("/{callId}/reject")
    fun rejectCall(
        @PathVariable callId: String,
        @AuthenticationPrincipal userPrincipal: UserPrincipal,
    ) {
        callService.rejectCall(callId, requireNotNull(userPrincipal.user.id))
    }

    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PostMapping("/{callId}/end")
    fun endCall(
        @PathVariable callId: String,
        @AuthenticationPrincipal userPrincipal: UserPrincipal,
    ) {
        callService.endCall(callId, requireNotNull(userPrincipal.user.id))
    }

    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PostMapping("/{callId}/cancel")
    fun cancelCall(
        @PathVariable callId: String,
        @AuthenticationPrincipal userPrincipal: UserPrincipal,
    ) {
        callService.cancelCall(callId, requireNotNull(userPrincipal.user.id))
    }
}
