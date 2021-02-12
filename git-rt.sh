#! /bin/sh

branch=$(git symbolic-ref HEAD | sed -e 's,.*/\(.*\),\1,')

git fetch upstream

git rebase upstream/$branch

git push origin $branch

exit 0
