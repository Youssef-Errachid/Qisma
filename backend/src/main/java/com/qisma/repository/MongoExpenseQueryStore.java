package com.qisma.repository;

import com.qisma.dto.request.ExpenseSearchCriteria;
import com.qisma.enums.ExpenseStatus;
import com.qisma.model.Expense;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

@Repository
public class MongoExpenseQueryStore implements ExpenseQueryStore {

    private final MongoTemplate mongo;

    public MongoExpenseQueryStore(MongoTemplate mongo) {
        this.mongo = mongo;
    }

    @Override
    public Page<Expense> search(String groupId, ExpenseSearchCriteria c, Pageable pageable) {
        List<Criteria> parts = new ArrayList<>();
        parts.add(Criteria.where("groupId").is(groupId));
        parts.add(Criteria.where("status").is(ExpenseStatus.ACTIVE));

        // expenseDate is stored as ISO text, so a text range is a chronological range
        if (c.from() != null) {
            parts.add(Criteria.where("expenseDate").gte(c.from().toString()));
        }
        if (c.to() != null) {
            parts.add(Criteria.where("expenseDate").lte(c.to().toString()));
        }
        if (c.category() != null) {
            parts.add(Criteria.where("category").is(c.category()));
        }
        if (c.paidBy() != null) {
            parts.add(Criteria.where("paidBy").is(c.paidBy()));
        }
        if (c.participant() != null) {
            parts.add(Criteria.where("shares.userId").is(c.participant()));
        }
        if (c.q() != null) {
            // the text is quoted, so it is always searched literally and never interpreted as a pattern
            parts.add(Criteria.where("title").regex(Pattern.quote(c.q()), "i"));
        }

        Query query = new Query(new Criteria().andOperator(parts.toArray(new Criteria[0])));
        long total = mongo.count(query, Expense.class);
        List<Expense> items = mongo.find(query.with(pageable), Expense.class);
        return new PageImpl<>(items, pageable, total);
    }
}
