package com.daniel.messenger.user.controller

import com.daniel.messenger.security.userdetails.UserPrincipal
import com.daniel.messenger.user.dto.UserSearchResponse
import com.daniel.messenger.user.service.UserService
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/users")
class UserController(private val userService: UserService) {
    @GetMapping("/{id}")
    fun getUser(@PathVariable id : Long) : UserSearchResponse {
        val user = userService.findByIdOrThrow(id)
        return UserSearchResponse(id, user.username)
    }

    @GetMapping("/search")
    fun searchUsers(
        @RequestParam query: String,
        @AuthenticationPrincipal userPrincipal: UserPrincipal
    ): List<UserSearchResponse> {
        val currentUserId = requireNotNull(userPrincipal.user.id)
        return userService.searchUsers(query, currentUserId)
    }
}
