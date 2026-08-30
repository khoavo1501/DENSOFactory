"""Constants for source identification & device_id pattern inference."""
import re

# Pattern for inferring source from device_id when no mapping in DB
PATTERN_REAL = re.compile(r"^[A-Z]+_[A-Z]+_[0-9]+$")
PATTERN_SIMULATED = re.compile(r"^SIM_[A-Za-z0-9_-]{1,58}$")

SOURCE_SIMULATED = "simulated"
SOURCE_REAL = "real"

VALID_SOURCES = {SOURCE_SIMULATED, SOURCE_REAL}

# State enums (from payload spec mục 3.1)
STATE_ONLINE = "online"
STATE_OFFLINE = "offline"
STATE_ERROR = "error"
STATE_DEGRADED = "degraded"
VALID_STATES = {STATE_ONLINE, STATE_OFFLINE, STATE_ERROR, STATE_DEGRADED}

# Severity enums (from payload spec mục 4.1)
SEVERITY_INFO = "info"
SEVERITY_WARNING = "warning"
SEVERITY_CRITICAL = "critical"
VALID_SEVERITIES = {SEVERITY_INFO, SEVERITY_WARNING, SEVERITY_CRITICAL}

# Event code enums (from payload spec mục 4.2, closed enum v1)
VALID_EVENT_CODES = {
    "SLAVE_COMM_LOST",
    "SLAVE_COMM_RESTORED",
    "VALUE_OUT_OF_RANGE",
    "SENSOR_FAULT",
    "EMERGENCY_STOP",
    "FIRMWARE_UPDATE_START",
    "FIRMWARE_UPDATE_END",
    "CONFIG_CHANGED",
    "MASTER_REBOOT",
    "BUFFER_OVERFLOW",
    "WATCHDOG_RESET",
    "POWER_ON",
    "W5500_LINK_DOWN",
    "W5500_LINK_UP",
    "MQTT_DISCONNECTED",
    "MQTT_RECONNECTED",
}

# Roles
ROLE_ADMIN = "admin"
ROLE_VIEWER = "viewer"
VALID_ROLES = {ROLE_ADMIN, ROLE_VIEWER}
