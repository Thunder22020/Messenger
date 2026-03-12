package com.daniel.messenger.security.util

import com.daniel.messenger.security.userdetails.UserPrincipal
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import java.security.Principal

fun Principal.toUserPrincipal() =
    (this as UsernamePasswordAuthenticationToken).principal as UserPrincipal