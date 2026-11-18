# Stands in for git, gh, claude, and node on the release fixture's PATH. lab.mjs installs it under each of those names.
# It counts the call, injects the planned fault, then runs the real git or node, or the fake gh or claude.
# FAULT_AT names the call and FAULT_MODE the fault. fail exits 1 before the command runs. kill-before and kill-after
# send SIGKILL to release.mjs around the command. With RELEASE_TRACE set, it copies the world before and after every
# call, so lab.mjs can see which calls change it.
tool=${0##*/}
: "${RELEASE_RUN:?}" "${RELEASE_STATE:?}" "${REAL_GIT:?}" "${REAL_NODE:?}" "${RELEASE_FAKES:?}"
read -r n < "$RELEASE_RUN/count"
n=$((n + 1))
printf '%s\n' "$n" > "$RELEASE_RUN/count"
printf '%s\n' "$tool $*" >> "$RELEASE_RUN/trace"
fault=
[ "$n" = "$FAULT_AT" ] && fault=$FAULT_MODE
case $fault in
  fail)
    echo "injected fault: $tool exits 1 before it does anything" >&2
    exit 1
    ;;
  kill-before)
    kill -9 "$PPID"
    exit 137
    ;;
esac
# Most calls are a git call with no fault and no trace. Those become git itself, which saves a process.
[ -z "$fault$RELEASE_TRACE" ] && [ "$tool" = git ] && exec "$REAL_GIT" "$@"
[ -n "$RELEASE_TRACE" ] && /bin/cp -R "$RELEASE_STATE" "$RELEASE_TRACE/$n.kill-before"
case $tool in
  git) "$REAL_GIT" "$@" ;;
  node)
    case $1 in
      # The fixture's `sync.mjs --verify` and its test suite always pass, so no Node starts for them.
      tools/sync.mjs | --test) ;;
      *) "$REAL_NODE" "$@" ;;
    esac
    ;;
  gh)
    case "$1 $2" in
      "auth status") ;;
      "release view") [ -f "$RELEASE_STATE/gh/$3.json" ] ;;
      *) "$REAL_NODE" "$RELEASE_FAKES" gh "$@" ;;
    esac
    ;;
  claude) "$REAL_NODE" "$RELEASE_FAKES" claude "$@" ;;
  *)
    printf '%s\n' "no stand-in for $tool $*" >> "$RELEASE_RUN/unmodeled"
    exit 97
    ;;
esac
status=$?
[ -n "$RELEASE_TRACE" ] && /bin/cp -R "$RELEASE_STATE" "$RELEASE_TRACE/$n.kill-after"
[ "$fault" = kill-after ] && kill -9 "$PPID"
exit $status
