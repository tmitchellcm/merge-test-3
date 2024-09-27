#my_custom_merge_driver.sh
#!/bin/bash

# Arguments passed from the git merge driver
BASE=$1  # Common ancestor
OURS=$2  # Current version (ours)
THEIRS=$3  # Incoming version (theirs)
FILE=$4  # The path to the conflicted file

# Temporary files for storing the blame results
OURS_BLAME=$(mktemp)
THEIRS_BLAME=$(mktemp)

# Blame the current and incoming versions of the file
git blame $OURS > $OURS_BLAME
git blame $THEIRS > $THEIRS_BLAME

# Flag to check if conflict should be resolved or left unresolved
AUTO_MERGE=true

# Read the conflicting file line by line
while read -r line; do
  if [[ "$line" =~ "<<<<<<<" ]]; then
    # Conflict start
    continue
  elif [[ "$line" =~ "=======" ]]; then
    # Conflict separator
    continue
  elif [[ "$line" =~ ">>>>>>>" ]]; then
    # Conflict end
    break
  fi

  # Extract the blame information for this line
  OURS_AUTHOR=$(grep "$line" $OURS_BLAME | awk '{print $2}')
  echo OURS_AUTHOR
  THEIRS_AUTHOR=$(grep "$line" $THEIRS_BLAME | awk '{print $2}')

  # If the line is changed by userA only, we keep the current (ours) version
  if [[ "$OURS_AUTHOR" == "Tom Mitchell" && "$THEIRS_AUTHOR" == "Tom Mitchell" ]]; then
    continue
  elif [[ "$OURS_AUTHOR" == "Tom Mitchell" || "$OURS_AUTHOR" == "userB" ]]; then
    # If userA or userB (or both) changed the line, don't auto merge
    AUTO_MERGE=false
    break
  fi
done < $FILE

# Decide what to do based on the above checks
if [ "$AUTO_MERGE" = true ]; then
  # Automatically resolve the conflict by keeping "ours"
  cat $OURS > $FILE
  echo "Conflict resolved by taking 'ours' because only userA made changes."
else
  # Leave the conflict unresolved (default Git behavior with conflict markers)
  echo "Merge conflict remains because userB or both userA and userB made changes."
  cat $BASE > $FILE
  echo "<<<<<<< ours" >> $FILE
  cat $OURS >> $FILE
  echo "=======" >> $FILE
  cat $THEIRS >> $FILE
  echo ">>>>>>> theirs" >> $FILE
fi

# Cleanup temporary files
rm $OURS_BLAME $THEIRS_BLAME

exit 0
