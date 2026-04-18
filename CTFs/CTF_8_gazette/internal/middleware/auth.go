package middleware

import (
	"net/http"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

// SessionUserKey is the session key used to persist the signed-in username.
const SessionUserKey = "username"

// RequireSession rejects requests without a valid session. API routes get a
// 401 JSON body; HTML routes get a redirect to the login page.
func RequireSession(apiJSON bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		sess := sessions.Default(c)
		u := sess.Get(SessionUserKey)
		if u == nil {
			if apiJSON {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
					"error": "authentication required",
				})
				return
			}
			c.Redirect(http.StatusFound, "/login?next="+c.Request.URL.Path)
			c.Abort()
			return
		}
		c.Set("username", u.(string))
		c.Next()
	}
}

// CurrentUsername returns the username from the current session context.
func CurrentUsername(c *gin.Context) string {
	if v, ok := c.Get("username"); ok {
		return v.(string)
	}
	return ""
}
