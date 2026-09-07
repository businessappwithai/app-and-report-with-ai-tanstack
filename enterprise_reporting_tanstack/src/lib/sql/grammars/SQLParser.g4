parser grammar SQLParser;

options {
  tokenVocab = SQLLexer;
}

// Entry point
statement: queryStatement (SEMICOLON)?;

queryStatement
  : selectStatement
  | withClause selectStatement
  ;

withClause
  : WITH RECURSIVE? cteDefinition (COMMA cteDefinition)*
  ;

cteDefinition
  : IDENTIFIER AS LPAREN selectStatement RPAREN
  ;

selectStatement
  : selectClause
    fromClause?
    whereClause?
    groupByClause?
    havingClause?
    orderByClause?
    limitClause?
  | selectStatement UNION (ALL)? selectStatement
  | selectStatement INTERSECT selectStatement
  | selectStatement EXCEPT selectStatement
  | LPAREN selectStatement RPAREN
  ;

selectClause
  : SELECT DISTINCT? selectList
  ;

selectList
  : selectItem (COMMA selectItem)*
  ;

selectItem
  : STAR (COMMA selectItem)*
  | expression (AS? IDENTIFIER)?
  ;

fromClause
  : FROM tableReference (COMMA tableReference)*
  ;

tableReference
  : tableName (AS? IDENTIFIER)?
  | LPAREN selectStatement RPAREN (AS? IDENTIFIER)
  | tableReference joinOperator tableReference ON expression
  ;

tableName
  : IDENTIFIER (DOT IDENTIFIER)?
  ;

joinOperator
  : JOIN
  | INNER JOIN
  | LEFT OUTER? JOIN
  | RIGHT OUTER? JOIN
  | FULL OUTER JOIN
  ;

whereClause
  : WHERE expression
  ;

groupByClause
  : GROUP BY expression (COMMA expression)*
  ;

havingClause
  : HAVING expression
  ;

orderByClause
  : ORDER BY orderByItem (COMMA orderByItem)*
  ;

orderByItem
  : expression (ASC | DESC)?
  ;

limitClause
  : LIMIT NUMBER (OFFSET NUMBER)?
  | OFFSET NUMBER
  | FETCH (NEXT | FIRST)? NUMBER (ROWS | ROW) ONLY
  ;

expression
  : primaryExpression
  | expression binaryOp expression
  | expression IS NULL
  | expression IS NOT NULL
  | expression IN LPAREN (selectStatement | valueList) RPAREN
  | expression NOT IN LPAREN (selectStatement | valueList) RPAREN
  | expression LIKE expression
  | expression ILIKE expression
  | expression BETWEEN expression AND expression
  | CASE (WHEN expression THEN expression)+ (ELSE expression)? END
  | functionCall
  ;

primaryExpression
  : LPAREN expression RPAREN
  | literal
  | columnRef
  | STAR
  | QUESTION
  ;

columnRef
  : IDENTIFIER (DOT IDENTIFIER)?
  ;

functionCall
  : functionName LPAREN (DISTINCT)? (expression (COMMA expression)*)? RPAREN
  | functionName LPAREN RPAREN
  | functionName LPAREN STAR RPAREN
  | functionName LPAREN expression RPAREN OVER LPAREN (PARTITION BY expression (COMMA expression)*)? orderByClause? RPAREN
  ;

functionName
  : COUNT
  | SUM
  | AVG
  | MIN
  | MAX
  | STDDEV
  | VARIANCE
  | SUBSTRING
  | LENGTH
  | UPPER
  | LOWER
  | TRIM
  | LTRIM
  | RTRIM
  | CONCAT
  | COALESCE
  | NULLIF
  | ROUND
  | FLOOR
  | CEIL
  | ABS
  | CAST
  | EXTRACT
  | DATE_TRUNC
  | NOW
  | CURRENT_DATE
  | CURRENT_TIME
  | CURRENT_TIMESTAMP
  | IDENTIFIER
  ;

binaryOp
  : PLUS
  | MINUS
  | STAR
  | SLASH
  | PERCENT
  | EQ
  | NEQ
  | LT
  | GT
  | LTE
  | GTE
  | AND
  | OR
  | CONCAT_OP
  ;

literal
  : STRING
  | NUMBER
  | TRUE
  | FALSE
  | NULL
  ;

valueList
  : literal (COMMA literal)*
  ;
