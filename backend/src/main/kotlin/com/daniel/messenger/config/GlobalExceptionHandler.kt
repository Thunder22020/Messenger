package com.daniel.messenger.config

import com.daniel.messenger.messaging.exception.ChatNotFoundException
import com.daniel.messenger.messaging.exception.CannotAddParticipantToPrivateChatException
import com.daniel.messenger.messaging.exception.CannotCreateChatWithYourselfException
import com.daniel.messenger.messaging.exception.GroupTitleIsNullException
import com.daniel.messenger.messaging.exception.MessageNotFoundException
import com.daniel.messenger.messaging.exception.NotChatParticipantException
import com.daniel.messenger.messaging.exception.NotMessageOwnerException
import com.daniel.messenger.security.exception.InvalidRefreshTokenException
import com.daniel.messenger.security.exception.RefreshTokenExpiredException
import com.daniel.messenger.user.exception.UserAlreadyExistsException
import com.daniel.messenger.user.exception.UserNotFoundException
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

@RestControllerAdvice
class GlobalExceptionHandler {

    data class ErrorResponse(val error: String)

    @ExceptionHandler(
        ChatNotFoundException::class,
        MessageNotFoundException::class,
        UserNotFoundException::class)
    fun handleNotFound(ex: RuntimeException): ResponseEntity<ErrorResponse> =
        ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(ErrorResponse(ex.message ?: "Not found"))

    @ExceptionHandler(
        NotChatParticipantException::class,
        NotMessageOwnerException::class,
        CannotAddParticipantToPrivateChatException::class,
    )
    fun handleForbidden(ex: RuntimeException): ResponseEntity<ErrorResponse> =
        ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(ErrorResponse(ex.message ?: "Forbidden"))

    @ExceptionHandler(
        CannotCreateChatWithYourselfException::class,
        GroupTitleIsNullException::class,
        UserAlreadyExistsException::class,
    )
    fun handleBadRequest(ex: RuntimeException): ResponseEntity<ErrorResponse> =
        ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(ErrorResponse(ex.message ?: "Bad request"))

    @ExceptionHandler(InvalidRefreshTokenException::class, RefreshTokenExpiredException::class)
    fun handleUnauthorized(ex: RuntimeException): ResponseEntity<ErrorResponse> =
        ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .body(ErrorResponse(ex.message ?: "Unauthorized"))

    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun handleValidation(ex: MethodArgumentNotValidException): ResponseEntity<ErrorResponse> {
        val message = ex.bindingResult.fieldErrors
            .firstOrNull()?.defaultMessage ?: "Invalid request"
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ErrorResponse(message))
    }
}
