import { useState, useEffect, useRef } from "react"
import { backend_url } from "../config.js"

const NotificationBell = () => {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const ref = useRef()

  const fetchNotifications = async () => {
    try {
      const res  = await fetch(`${backend_url}/notifications`, {
        method: "GET",
        credentials: "include",
      })
      const data = await res.json()
      setNotifications(data.notifications || [])
      setUnreadCount(data.unread_count    || 0)
    } catch (e) {
      console.error("Failed to fetch notifications", e)
    }
  }

  useEffect(() => { fetchNotifications() }, [])

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const handleOpen = async () => {
    setOpen(prev => !prev)
    if (!open && unreadCount > 0) {
      await fetch(`${backend_url}/notifications/mark-read`, {
        method:  "PATCH",
        credentials: "include",
      })
      setUnreadCount(0)
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    }
  }

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr)
    const mins = Math.floor(diff / 60000)
    if (mins < 1)  return "just now"
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24)  return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className="relative flex items-center justify-center h-9 w-9 rounded-lg bg-[#0d171b] dark:bg-slate-800 text-white hover:bg-[#1a2830] dark:hover:bg-slate-700 transition-all"
      >
        <span className="material-symbols-outlined text-xl">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 bg-[#13a4ec] text-white
                           text-xs rounded-full flex items-center justify-center font-bold">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#0d171b] rounded-xl
                        shadow-xl border border-slate-200 dark:border-slate-800 z-50">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <span className="font-bold text-sm text-[#0d171b] dark:text-white"
                  style={{ fontFamily: "Manrope, sans-serif" }}>
              Notifications
            </span>
            <button onClick={fetchNotifications}
                    className="text-xs text-[#13a4ec] hover:underline"
                    style={{ fontFamily: "Manrope, sans-serif" }}>
              Refresh
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {notifications.length === 0 ? (
              <p className="text-center text-slate-400 py-10 text-sm"
                 style={{ fontFamily: "Manrope, sans-serif" }}>
                No notifications yet
              </p>
            ) : (
              notifications.map((n) => (
                <div key={n._id}
                     className={`px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition
                                 ${!n.is_read ? "bg-[#13a4ec]/5" : ""}`}>
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="font-bold text-sm text-[#0d171b] dark:text-white"
                            style={{ fontFamily: "Manrope, sans-serif" }}>
                        {n.ticker}
                      </span>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed"
                         style={{ fontFamily: "Manrope, sans-serif" }}>
                        {n.message}
                      </p>
                    </div>
                    {!n.is_read && (
                      <span className="h-2 w-2 rounded-full bg-[#13a4ec] mt-1 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5"
                     style={{ fontFamily: "Manrope, sans-serif" }}>
                    {timeAgo(n.created_at)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationBell;