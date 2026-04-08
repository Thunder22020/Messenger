package com.daniel.messenger.messaging.controller

import com.daniel.messenger.messaging.dto.request.EditMessageRequest
import com.daniel.messenger.messaging.dto.response.MessageResponse
import com.daniel.messenger.messaging.dto.response.PagedMessageResponse
import com.daniel.messenger.messaging.service.MessageService
import com.daniel.messenger.messaging.service.ReactionService
import com.daniel.messenger.security.userdetails.UserPrincipal
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import jakarta.validation.Valid
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

data class ToggleReactionRequest(val emoji: String)

@RestController
@RequestMapping("/messages")
class MessageController(
    private val messageService: MessageService,
    private val reactionService: ReactionService,
) {
    @GetMapping("/{chatId}", params = ["after"])
    fun getMessagesAfter(
        @PathVariable chatId: Long,
        @RequestParam(required = true) after: Long,
        @AuthenticationPrincipal userPrincipal: UserPrincipal,
    ): PagedMessageResponse {
        val userId = requireNotNull(userPrincipal.user.id)
        return messageService.getMessagesAfter(chatId, userId, after)
    }

    @GetMapping("/{chatId}", params = ["before"])
    fun getMessagesBefore(
        @PathVariable chatId: Long,
        @RequestParam(required = true) before: Long,
        @AuthenticationPrincipal userPrincipal: UserPrincipal,
    ): PagedMessageResponse {
        val userId = requireNotNull(userPrincipal.user.id)
        return messageService.getMessagesBefore(chatId, userId, before)
    }

    @GetMapping("/{chatId}", params = ["around"])
    fun getMessagesAround(
        @PathVariable chatId: Long,
        @RequestParam(required = true) around: Long,
        @AuthenticationPrincipal userPrincipal: UserPrincipal,
    ): PagedMessageResponse {
        val userId = requireNotNull(userPrincipal.user.id)
        return messageService.getMessagesAround(chatId, userId, around)
    }

    @GetMapping("/{chatId}")
    fun getMessages(
        @PathVariable chatId: Long,
        @AuthenticationPrincipal userPrincipal: UserPrincipal,
    ): PagedMessageResponse {
        val userId = requireNotNull(userPrincipal.user.id)
        return messageService.getMessages(chatId, userId)
    }

    @PatchMapping("/{messageId}")
    fun editMessage(
        @PathVariable messageId: Long,
        @Valid @RequestBody request: EditMessageRequest,
        @AuthenticationPrincipal userPrincipal: UserPrincipal,
    ): MessageResponse {
        val userId = requireNotNull(userPrincipal.user.id)
        return messageService.editMessage(messageId, request, userId)
    }

    @DeleteMapping("/{messageId}")
    fun deleteMessage(
        @PathVariable messageId: Long,
        @AuthenticationPrincipal userPrincipal: UserPrincipal,
    ): MessageResponse {
        val userId = requireNotNull(userPrincipal.user.id)
        return messageService.deleteMessage(messageId, userId)
    }

    @PostMapping("/{messageId}/reactions")
    @ResponseStatus(HttpStatus.OK)
    fun toggleReaction(
        @PathVariable messageId: Long,
        @RequestBody body: ToggleReactionRequest,
        @AuthenticationPrincipal userPrincipal: UserPrincipal,
    ): ResponseEntity<Void> {
        require(body.emoji.isNotBlank() && body.emoji.length <= 16) { "Invalid emoji" }
        val userId = requireNotNull(userPrincipal.user.id)
        reactionService.toggleReaction(messageId, userId, body.emoji)
        return ResponseEntity.ok().build()
    }

    @GetMapping("/search")
    fun searchMessagesByContent(
        @RequestParam("chatId") chatId: Long,
        @RequestParam("q") query: String,
        @AuthenticationPrincipal userPrincipal: UserPrincipal,
    ): List<MessageResponse> {
        val userId = requireNotNull(userPrincipal.user.id)
        return messageService.searchMessagesByContent(chatId, userId, query)
    }
}
