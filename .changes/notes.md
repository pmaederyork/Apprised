Have cluade run through doc editing senerios:
- fix "remove all empty lines"
- Convervt all "-" to lists


Merge:
Switch to main branch: git checkout main
Pull latest from remote: git pull origin main (ensure main is up to date)
Merge feature branch: git merge [Branchname]
Push merged changes: git push origin main

Delete Branches:
git branch --merged main | grep -v "main" | xargs git branch -d